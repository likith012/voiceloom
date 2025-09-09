from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.domain.states import JobState


# Voice configuration
class VoiceConfig(BaseModel):
    """
    Per-role voice parameters for synthesis.
    - name: prebuilt voice name.
    """
    name: str = Field(..., min_length=1)

SpeakerRegistry = Dict[str, VoiceConfig]


# API: Create Job
class JobCreate(BaseModel):
    """
    Create a multi-speaker TTS job.
    """
    script: str = Field(..., min_length=1, description="Full text with [Role] tags")
    roles: List[str] = Field(default_factory=list, description="Role names used in the script")


class JobCreateResponse(BaseModel):
    jobId: str


# API: Job Status
class JobStatus(BaseModel):
    id: str
    state: JobState
    error: Optional[str] = None
    createdAt: float
    updatedAt: float


class Manifest(BaseModel):
    """
    What the reader UI needs to render and play a job.
    """
    audioUrl: str
    timingsUrl: str
    script: str


# API: Timings (alignment output on final audio)
class WordTiming(BaseModel):
    """
    One token with start/end timestamps in seconds.
    idx: token index in the linearized script for fast DOM mapping.
    """
    w: str
    s: float
    e: float
    idx: int


class TimingsResponse(BaseModel):
    words: List[WordTiming]
