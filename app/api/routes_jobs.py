from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from app.core.config import get_settings
from app.domain.schemas import (
    JobCreate,
    JobCreateResponse,
    JobStatus,
    Manifest,
)
from app.domain.states import JobState
from app.services.jobs.manager import JobManager  


router = APIRouter()


def get_manager() -> JobManager:
    """Build a JobManager using current Settings."""
    s = get_settings()
    return JobManager(
        data_dir=s.data_dir,
        jobs_dir=s.jobs_path,
        cache_dir=s.cache_path,
        google_api_key=s.google_api_key,
        tts_model=s.tts_model,
        whisper_model=s.whisper_model,
        whisper_device=s.whisper_device,
        whisper_compute_type=s.whisper_compute_type,
        request_timeout_sec=s.request_timeout_sec,
        max_text_chars=s.max_text_chars,
    )


@router.post("/jobs", response_model=JobCreateResponse)
def create_job(
    body: JobCreate,
    background: BackgroundTasks,
    manager: JobManager = Depends(get_manager),
) -> JobCreateResponse:
    """
    Create a TTS job. The request includes:
    - script: full text with [Role] tags
    - roles: Role names
    """
    # For oversized scripts
    if len(body.script) > manager.max_text_chars:
        raise HTTPException(status_code=413, detail="script too large")
    
    if not body.roles:
        raise HTTPException(status_code=400, detail="roles must include at least one role")

    job_id = manager.create_job(body)
    background.add_task(manager.run_job, job_id) # Background work (synthesis -> mastering -> alignment)
    return JobCreateResponse(jobId=job_id)


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str, manager: JobManager = Depends(get_manager)) -> JobStatus:
    status = manager.get_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="job not found")
    return status


@router.get("/jobs/{job_id}/manifest", response_model=Manifest)
def get_manifest(job_id: str, manager: JobManager = Depends(get_manager)) -> Manifest:
    if not manager.exists(job_id):
        raise HTTPException(status_code=404, detail="job not found")
    try:
        return manager.get_manifest(job_id)
    except FileNotFoundError:
        st = manager.get_status(job_id)
        if st and st.state == JobState.FAILED:
            raise HTTPException(status_code=400, detail=st.error or "job failed")
        raise HTTPException(status_code=409, detail="job not ready")


@router.get("/jobs/{job_id}/audio")
def get_audio(job_id: str, manager: JobManager = Depends(get_manager)) -> FileResponse:
    if not manager.exists(job_id):
        raise HTTPException(status_code=404, detail="job not found")
    path = manager.get_audio_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=409, detail="audio not ready")
    media_type = "audio/wav" if path.suffix.lower() == ".wav" else "audio/mpeg"
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/jobs/{job_id}/timings")
def get_timings(job_id: str, manager: JobManager = Depends(get_manager)) -> JSONResponse:
    if not manager.exists(job_id):
        raise HTTPException(status_code=404, detail="job not found")
    path = manager.get_timings_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=409, detail="timings not ready")
    return JSONResponse(manager.read_timings(job_id))
