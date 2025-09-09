from enum import Enum


class JobState(str, Enum):
    """
    Canonical lifecycle of a TTS job.
    """
    PENDING = "PENDING"           # Created, enqueued
    SYNTHESIZING = "SYNTHESIZING" # Calling backend TTS API
    MASTERING = "MASTERING"       # Post-processing
    ALIGNING = "ALIGNING"         # Word-level alignment
    READY = "READY"               # Audio + alignment available
    FAILED = "FAILED"             # Terminal failure


TERMINAL_STATES: set[JobState] = {JobState.READY, JobState.FAILED}

_ALLOWED: dict[JobState, set[JobState]] = {
    JobState.PENDING: {JobState.SYNTHESIZING, JobState.FAILED},
    JobState.SYNTHESIZING: {JobState.MASTERING, JobState.FAILED},
    JobState.MASTERING: {JobState.ALIGNING, JobState.FAILED},
    JobState.ALIGNING: {JobState.READY, JobState.FAILED},
    JobState.READY: set(),
    JobState.FAILED: set(),
}


def is_terminal(state: JobState) -> bool:
    """True if the state is a terminal state."""
    return state in TERMINAL_STATES


def can_transition(src: JobState, dst: JobState) -> bool:
    """Validate if a state transition is allowed."""
    return dst in _ALLOWED.get(src, set())
