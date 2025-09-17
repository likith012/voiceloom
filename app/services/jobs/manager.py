import json
import os
import shutil
import time
import uuid
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, List

from app.utils.instructions import prepend_tts_instructions
from app.domain.schemas import JobCreate, JobStatus, Manifest, SpeakerRegistry
from app.domain.states import JobState, can_transition
from app.utils.roles import resolve_registry
from app.services.synth.singlepass import synthesize_single_pass  
from app.services.synth.chunking import synthesize_chunked
from app.utils.cache import make_cache_key, lookup_origin_job, record_origin_job
from app.services.align.aligner import align_audio
from app.utils.logging import get_logger
from app.services.process.mastering import (
    parse_text,
    build_ui_script,
    build_alignment_text_from_ui,
)
from app.services.process.normalization import apply_de_dialect

logger = get_logger(__name__)


@dataclass
class ManagerConfig:
    data_dir: Path
    jobs_dir: Path
    cache_dir: Path
    google_api_key: str
    do_chunk: bool
    tts_model: str
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    request_timeout_sec: int
    max_text_chars: int
    de_dialect: bool


class JobManager:
    """
    Filesystem-backed job orchestrator. Creates a job directory, writes request metadata, transitions states, 
    calls TTS, then runs alignment on the final audio.
    """

    def __init__(
        self,
        data_dir: Path,
        jobs_dir: Path,
        cache_dir: Path,
        google_api_key: str,
        do_chunk: bool,
        tts_model: str,
        whisper_model: str,
        whisper_device: str,
        whisper_compute_type: str,
        request_timeout_sec: int,
        max_text_chars: int,
        de_dialect: bool = False,
    ):
        self.cfg = ManagerConfig(
            data_dir=data_dir,
            jobs_dir=jobs_dir,
            cache_dir=cache_dir,
            google_api_key=google_api_key,
            do_chunk=do_chunk,
            tts_model=tts_model,
            whisper_model=whisper_model,
            whisper_device=whisper_device,
            whisper_compute_type=whisper_compute_type,
            request_timeout_sec=request_timeout_sec,
            max_text_chars=max_text_chars,
            de_dialect=de_dialect,
        )
        
        self.cfg.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.cfg.cache_dir.mkdir(parents=True, exist_ok=True)
        self._app_root = Path(__file__).resolve().parents[2]

    # --- Used by routes ---

    @property
    def max_text_chars(self) -> int:
        return self.cfg.max_text_chars

    def create_job(self, body: JobCreate) -> str:
        job_id = uuid.uuid4().hex
        jd = self._job_dir(job_id)
        jd.mkdir(parents=True, exist_ok=True)

        # Persist request
        if logger.isEnabledFor(logging.DEBUG):
            self._write_json(jd / "request.json", body.model_dump(mode="json"))
            (jd / "script.txt").write_text(body.script, encoding="utf-8")

        # Initialize status
        now = time.time()
        self._write_json(jd / "status.json", {
            "id": job_id,
            "state": JobState.PENDING.value,
            "error": None,
            "createdAt": now,
            "updatedAt": now,
        })

        return job_id

    def run_job(self, job_id: str) -> None:
        try:
            self._transition(job_id, JobState.SYNTHESIZING) 

            body = self._read_request(job_id)
            script: str = body["script"]
            roles: List[str] = body.get("roles") or []
            
            # Resolve registry from YAML file
            registry: SpeakerRegistry = resolve_registry(
                roles,
                search_paths=[
                    self._app_root / "config" / "voices.yml",
                    self._app_root / "config" / "voices.yaml",
                ],
            )

            doc = parse_text(script)
            ui_script = build_ui_script(doc)
            if self.cfg.de_dialect:
                ui_script = apply_de_dialect(ui_script)
            alignment_script = build_alignment_text_from_ui(ui_script)

            effective_script = prepend_tts_instructions(script)

            # --- Cache Hit ---

            cache_key = make_cache_key(alignment_script, registry, self.cfg.tts_model)
            origin_job = lookup_origin_job(self.cfg.cache_dir, cache_key)
            jd = self._job_dir(job_id)
            
            if origin_job and self._is_ready_job(origin_job):
                logger.info(f"Cache hit for job {job_id}, using origin job {origin_job}")
                origin_audio = self._job_dir(origin_job) / "tts_out.wav"
                origin_timings = self._job_dir(origin_job) / "timings.json"

                if not origin_audio.exists() or not origin_timings.exists():
                    msg = f"Cache inconsistency: READY job {origin_job} missing artifacts"
                    logger.error(msg)
                    raise RuntimeError(msg)

                self._link_or_copy(origin_audio, jd / "tts_out.wav")
                self._link_or_copy(origin_timings, jd / "timings.json")

                manifest = Manifest(
                    audioUrl=f"/v1/tts/jobs/{job_id}/audio",
                    timingsUrl=f"/v1/tts/jobs/{job_id}/timings",
                    script=ui_script,
                )
                self._write_json(jd / "manifest.json", manifest.model_dump(mode="json"))

                self._transition(job_id, JobState.ALIGNING)
                self._transition(job_id, JobState.READY)
                return
            
            # --- Cache Miss ---
            logger.info(f"Cache miss for job {job_id}")

            # 1) Synthesis
            logger.info(f"Starting synthesis for job {job_id}")
            
            if self.cfg.do_chunk:
                audio_path = synthesize_chunked(
                    script=effective_script,
                    registry=registry,
                    output_dir=self._job_dir(job_id),
                    output_basename="tts_out",
                    google_api_key=self.cfg.google_api_key,
                    tts_model=self.cfg.tts_model,
                    request_timeout_sec=self.cfg.request_timeout_sec,
                )
            else:
                audio_path = synthesize_single_pass(
                    script=effective_script,
                    registry=registry,
                    output_dir=self._job_dir(job_id),
                    output_basename="tts_out",  
                    google_api_key=self.cfg.google_api_key,
                    tts_model=self.cfg.tts_model,
                    request_timeout_sec=self.cfg.request_timeout_sec,
                )
            logger.info(f"Synthesis complete for job {job_id}, audio at {audio_path}")

            # 2) Alignment
            self._transition(job_id, JobState.ALIGNING)
            logger.info(f"Starting alignment for job {job_id}")
            
            timings = align_audio(
                audio_path=audio_path,
                script=alignment_script,
                model_name=self.cfg.whisper_model,
                device=self.cfg.whisper_device,
                compute_type=self.cfg.whisper_compute_type,
            )
            self._write_json(self._job_dir(job_id) / "timings.json", timings)
            logger.info(f"Alignment complete for job {job_id}")
            
            # Manifest
            manifest = Manifest(
                audioUrl=f"/v1/tts/jobs/{job_id}/audio",
                timingsUrl=f"/v1/tts/jobs/{job_id}/timings",
                script=ui_script,
            )
            self._write_json(self._job_dir(job_id) / "manifest.json", manifest.model_dump(mode="json"))
            
            if logger.isEnabledFor(logging.DEBUG):
                (self._job_dir(job_id) / "ui_script.txt").write_text(ui_script, encoding="utf-8")
                (self._job_dir(job_id) / "alignment_script.txt").write_text(alignment_script, encoding="utf-8")

            self._transition(job_id, JobState.READY)
            logger.info(f"Job {job_id} is READY")

            record_origin_job(self.cfg.cache_dir, cache_key, job_id)  # Record cache (only after READY succeeds)

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)
            self._transition(job_id, JobState.FAILED, error=str(e))
            
    def _is_ready_job(self, job_id: str) -> bool:
        st = self._read_json(self._job_dir(job_id) / "status.json")
        try:
            return st and st.get("state") == JobState.READY.value
        except Exception:
            return False
        
    @staticmethod
    def _link_or_copy(src: Path, dst: Path) -> None:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            return
        try:
            os.link(src, dst)  # hard link (no extra space)
        except Exception:
            try:
                os.symlink(src, dst)  # fallback to symlink
            except Exception:
                shutil.copy2(src, dst)  # last resort: copy

    def get_status(self, job_id: str) -> Optional[JobStatus]:
        st = self._read_json(self._job_dir(job_id) / "status.json")
        if not st:
            return None
        return JobStatus(
            id=st["id"],
            state=JobState(st["state"]),
            error=st.get("error"),
            createdAt=st["createdAt"],
            updatedAt=st["updatedAt"],
        )

    def get_manifest(self, job_id: str) -> Manifest:
        d = self._read_json(self._job_dir(job_id) / "manifest.json")
        if not d:
            raise FileNotFoundError("manifest missing")
        return Manifest(**d)

    def get_audio_path(self, job_id: str) -> Path:
        p = self._job_dir(job_id) / "tts_out.wav"
        return p

    def get_timings_path(self, job_id: str) -> Path:
        return self._job_dir(job_id) / "timings.json"

    def read_timings(self, job_id: str) -> Dict[str, Any]:
        d = self._read_json(self.get_timings_path(job_id))
        if not d:
            raise FileNotFoundError("timings missing")
        return d

    def exists(self, job_id: str) -> bool:
        return self._job_dir(job_id).exists()

    # --- Utils ---

    def _job_dir(self, job_id: str) -> Path:
        return self.cfg.jobs_dir / job_id

    def _read_request(self, job_id: str) -> Dict[str, Any]:
        return self._read_json(self._job_dir(job_id) / "request.json") or {}

    def _transition(self, job_id: str, dst_state: JobState, error: Optional[str] = None) -> None:
        st_path = self._job_dir(job_id) / "status.json"
        st = self._read_json(st_path)
        if not st:
            raise RuntimeError("job status missing")

        src_state = JobState(st["state"])
        if not can_transition(src_state, dst_state):
            # Still update error + updatedAt, but keep remaining state
            if error:
                st["error"] = error
                st["updatedAt"] = time.time()
                self._write_json(st_path, st)
            raise RuntimeError(f"Invalid state transition: {src_state.value} -> {dst_state.value}")

        st["state"] = dst_state.value
        if error:
            st["error"] = error
        st["updatedAt"] = time.time()
        self._write_json(st_path, st)

    @staticmethod
    def _write_json(path: Path, data: Dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def _read_json(path: Path) -> Optional[Dict[str, Any]]:
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
