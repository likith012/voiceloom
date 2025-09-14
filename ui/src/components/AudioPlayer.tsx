import { useState, useRef, useEffect } from 'react';
import { Button } from './ui-kit/button';
import { Slider } from './ui-kit/slider';
import { Card } from './ui-kit/card';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge, ChevronDown } from 'lucide-react';

interface SeekRequest { time: number; token: number }
interface AudioPlayerProps {
	audioUrl: string;
	onTimeUpdate: (currentTime: number) => void;
	duration?: number;
	externalSeek?: SeekRequest | null;
}

export function AudioPlayer({ audioUrl, onTimeUpdate, duration = 0, externalSeek = null }: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [audioDuration, setAudioDuration] = useState(duration);
	const [playbackRate, setPlaybackRate] = useState(1);
	const [volume, setVolume] = useState(0.8);
	const [isMuted, setIsMuted] = useState(false);
	const [isControlsVisible, setIsControlsVisible] = useState(true);
	const [showSpeedSlider, setShowSpeedSlider] = useState(false);
	const [showVolumeSlider, setShowVolumeSlider] = useState(false);
	const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSeekTokenRef = useRef<number | null>(null);
	const lastInteractionAtRef = useRef<number>(0);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => {
			const time = audio.currentTime;
			setCurrentTime(time);
			onTimeUpdate(time);
		};

		const handleLoadedMetadata = () => {
			setAudioDuration(audio.duration || duration);
		};

		const handleEnded = () => {
			setIsPlaying(false);
			setIsControlsVisible(true);
		};

		const handleError = () => {
			setAudioDuration(duration || 30);
		};

		audio.addEventListener('timeupdate', handleTimeUpdate);
		audio.addEventListener('loadedmetadata', handleLoadedMetadata);
		audio.addEventListener('ended', handleEnded);
		audio.addEventListener('error', handleError);

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate);
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
			audio.removeEventListener('ended', handleEnded);
			audio.removeEventListener('error', handleError);
		};
	}, [onTimeUpdate, duration]);

	// Apply external seek
	useEffect(() => {
		if (!externalSeek) return;
		if (lastSeekTokenRef.current === externalSeek.token) return;
		const audio = audioRef.current;
		if (!audio) return;
		const t = Math.max(0, Math.min(externalSeek.time, audioDuration || duration));
		audio.currentTime = t;
		setCurrentTime(t);
		onTimeUpdate(t);
		lastSeekTokenRef.current = externalSeek.token;
		// keep current play state; show controls
		handleUserInteraction();
	}, [externalSeek]);

	// Auto-hide controls
	const resetHideTimer = () => {
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
		}

		if (isPlaying) {
				hideTimeoutRef.current = setTimeout(() => {
				setIsControlsVisible(false);
				setShowSpeedSlider(false);
				setShowVolumeSlider(false);
				}, 4000);
		}
	};

	const showControls = () => {
		if (!isControlsVisible) setIsControlsVisible(true);
		resetHideTimer();
	};

	const handleUserInteraction = () => {
		const now = Date.now();
		if (now - lastInteractionAtRef.current < 200) return;
		lastInteractionAtRef.current = now;
		showControls();
	};

	const togglePlayPause = async () => {
		const audio = audioRef.current;
		if (!audio) return;

		try {
			if (isPlaying) {
				audio.pause();
				setIsPlaying(false);
				setIsControlsVisible(true);
				if (hideTimeoutRef.current) {
					clearTimeout(hideTimeoutRef.current);
				}
			} else {
				await audio.play();
				setIsPlaying(true);
				resetHideTimer();
			}
		} catch (error) {
			setIsPlaying(false);
			setIsControlsVisible(true);
		}
	};

	const seek = (seconds: number) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newTime = Math.max(0, Math.min(audioDuration, currentTime + seconds));
		audio.currentTime = newTime;
		setCurrentTime(newTime);
		handleUserInteraction();
	};

	const handleProgressChange = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newTime = value[0];
		audio.currentTime = newTime;
		setCurrentTime(newTime);
		onTimeUpdate(newTime);
		handleUserInteraction();
	};

	const handleSpeedChange = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newRate = value[0];
		setPlaybackRate(newRate);
		audio.playbackRate = newRate;
		handleUserInteraction();
	};

	const handleVolumeChange = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newVolume = value[0];
		setVolume(newVolume);
		audio.volume = newVolume;
		setIsMuted(newVolume === 0);
		handleUserInteraction();
	};

	// toggleMute is unused in current layout

	const handleCollapse = () => {
		setIsControlsVisible(false);
		setShowSpeedSlider(false);
		setShowVolumeSlider(false);
	};

	const toggleSpeedSlider = () => {
		setShowSpeedSlider(!showSpeedSlider);
		setShowVolumeSlider(false);
		handleUserInteraction();
	};

	const toggleVolumeSlider = () => {
		setShowVolumeSlider(!showVolumeSlider);
		setShowSpeedSlider(false);
		handleUserInteraction();
	};

	// Clean up timer
	useEffect(() => {
		return () => {
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
		};
	}, []);

	// Handle play state
	useEffect(() => {
		if (isPlaying) {
			resetHideTimer();
		} else {
			setIsControlsVisible(true);
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
		}
	}, [isPlaying]);

	const formatTime = (time: number) => {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	// Progress percentage placeholder

	return (
		<>
			{/* Audio element - always present for continuous playback */}
			<audio 
				ref={audioRef} 
				src={audioUrl} 
				preload="none"
				onError={() => {}}
			/>
      
			{/* Invisible interaction area - limited to player footprint for show-on-hover */}
			<div 
				className="fixed bottom-0 left-6 right-6 z-40 max-w-lg mx-auto h-24 sm:h-28 pointer-events-auto"
				onMouseEnter={handleUserInteraction}
				onTouchStart={handleUserInteraction}
				onClick={handleUserInteraction}
			/>

			{/* Main Player UI */}
			<motion.div
				initial={{ y: 100, opacity: 0 }}
				animate={{ 
					y: isControlsVisible ? 0 : 60, 
					opacity: isControlsVisible ? 1 : 0
				}}
				transition={{ 
					duration: 0.25,
					ease: "easeInOut"
				}}
				className="fixed bottom-6 left-6 right-6 z-50 max-w-lg mx-auto"
				style={{ pointerEvents: isControlsVisible ? 'auto' : 'none', willChange: 'transform, opacity' }}
			>
				<Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/50">
					<motion.div
						initial={{ height: 0 }}
						animate={{ height: "auto" }}
						transition={{ duration: 0.3, ease: "easeOut" }}
						className="p-6"
					>
						{/* Progress Bar */}
						<motion.div 
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05, duration: 0.2 }}
							className="mb-6"
						>
							<div className="mb-3 group">
								<Slider
									value={[currentTime]}
									max={audioDuration}
									step={0.1}
									onValueChange={handleProgressChange}
									className="w-full cursor-pointer"
									style={{
										'--slider-track-height': '4px',
										'--slider-thumb-size': '14px',
										'--slider-range-bg': '#3b82f6',
										'--slider-track-bg': 'rgba(148, 163, 184, 0.25)',
										'--slider-track-bg-dark': 'rgba(71, 85, 105, 0.3)',
										'--slider-thumb-bg': '#3b82f6',
										'--slider-thumb-border': '#ffffff',
										'--slider-thumb-shadow': '0 1px 6px rgba(59, 130, 246, 0.4)',
									} as any}
								/>
							</div>
              
							{/* Time Display */}
							<div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
								<span className="font-mono">{formatTime(currentTime)}</span>
								<span className="font-mono">{formatTime(audioDuration)}</span>
							</div>
						</motion.div>

						{/* Main Controls Row */}
						<motion.div 
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.2 }}
							className="flex items-center justify-between gap-4"
						>
							{/* Left Side - Speed Control */}
							<div className="relative">
								<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
									<Button
										variant="ghost"
										size="sm"
										onClick={toggleSpeedSlider}
										className="p-2 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all"
									>
										<Gauge className="w-5 h-5 text-slate-600 dark:text-slate-400" />
									</Button>
								</motion.div>
                
								{/* Speed Slider Popup */}
								<AnimatePresence>
									{showSpeedSlider && (
										<motion.div
											initial={{ opacity: 0, y: 20, scale: 0.9 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 20, scale: 0.9 }}
											transition={{ type: "spring", damping: 20, stiffness: 300 }}
											className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-white/20 dark:border-slate-700/50 min-w-[120px]"
										>
											<div className="text-center">
												<div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
													{playbackRate.toFixed(1)}×
												</div>
												<Slider
													value={[playbackRate]}
													min={0.5}
													max={2}
													step={0.1}
													onValueChange={handleSpeedChange}
													className="w-full cursor-pointer"
													style={{
														'--slider-track-height': '4px',
														'--slider-thumb-size': '12px',
														'--slider-range-bg': '#3b82f6',
														'--slider-track-bg': 'rgba(148, 163, 184, 0.3)',
														'--slider-track-bg-dark': 'rgba(71, 85, 105, 0.4)',
														'--slider-thumb-bg': '#3b82f6',
														'--slider-thumb-border': '#ffffff',
														'--slider-thumb-shadow': '0 1px 4px rgba(59, 130, 246, 0.4)',
													} as any}
												/>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							{/* Center - Playback Controls */}
							<div className="flex items-center gap-2">
								<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => seek(-15)}
										className="p-2 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all"
									>
										<RotateCcw className="w-4 h-4" />
									</Button>
								</motion.div>

								<motion.div 
									whileHover={{ scale: 1.05 }} 
									whileTap={{ scale: 0.95 }}
									className="relative mx-2"
								>
									<Button
										onClick={togglePlayPause}
										className="p-5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-200"
										size="lg"
									>
										{isPlaying ? (
											<Pause className="w-8 h-8" />
										) : (
											<Play className="w-8 h-8 ml-0.5" />
										)}
									</Button>
                  
									{/* Playing indicator */}
									{isPlaying && (
										<motion.div
											initial={{ scale: 0 }}
											animate={{ scale: 1 }}
											className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"
										>
											<div className="w-full h-full bg-green-500 rounded-full animate-pulse" />
										</motion.div>
									)}
								</motion.div>

								<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => seek(15)}
										className="p-2 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all"
									>
										<RotateCw className="w-4 h-4" />
									</Button>
								</motion.div>
							</div>

							{/* Right Side - Volume (Desktop) / Collapse (Mobile) */}
							<div className="relative">
								{/* Desktop Volume Control */}
								<div className="hidden sm:block">
									<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
										<Button
											variant="ghost"
											size="sm"
											onClick={toggleVolumeSlider}
											className="p-2 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all"
										>
											{isMuted ? (
												<VolumeX className="w-5 h-5 text-slate-500" />
											) : (
												<Volume2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
											)}
										</Button>
									</motion.div>
                  
									{/* Volume Slider Popup */}
									<AnimatePresence>
										{showVolumeSlider && (
											<motion.div
												initial={{ opacity: 0, y: 20, scale: 0.9 }}
												animate={{ opacity: 1, y: 0, scale: 1 }}
												exit={{ opacity: 0, y: 20, scale: 0.9 }}
												transition={{ duration: 0.2, ease: "easeOut" }}
												className="absolute bottom-full right-1/2 translate-x-1/2 mb-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-white/20 dark:border-slate-700/50 min-w-[120px]"
											>
												<div className="text-center">
													<div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
														{Math.round((isMuted ? 0 : volume) * 100)}%
													</div>
													<Slider
														value={[isMuted ? 0 : volume]}
														min={0}
														max={1}
														step={0.1}
														onValueChange={handleVolumeChange}
														className="w-full cursor-pointer"
														style={{
															'--slider-track-height': '4px',
															'--slider-thumb-size': '12px',
															'--slider-range-bg': '#3b82f6',
															'--slider-track-bg': 'rgba(148, 163, 184, 0.3)',
															'--slider-track-bg-dark': 'rgba(71, 85, 105, 0.4)',
															'--slider-thumb-bg': '#3b82f6',
															'--slider-thumb-border': '#ffffff',
															'--slider-thumb-shadow': '0 1px 4px rgba(59, 130, 246, 0.4)',
														} as any}
													/>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								{/* Mobile Collapse Button */}
								<div className="sm:hidden">
									<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCollapse}
											className="p-2 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all"
										>
											<ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
										</Button>
									</motion.div>
								</div>
							</div>
						</motion.div>
					</motion.div>
				</Card>
			</motion.div>
		</>
	);
}