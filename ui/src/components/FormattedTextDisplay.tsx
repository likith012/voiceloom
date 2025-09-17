import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from "motion/react";
import { BookOpen, Play, ChevronsDown } from "lucide-react";

interface Word {
	text: string;
	startTime: number;
	endTime: number;
	character?: string;
}

interface FormattedTextDisplayProps {
	words: Word[];
	displayLines: DisplayLine[];
	currentTime: number;
	characterColors: Record<string, string>;
	onWordClick?: (time: number, index: number) => void;
}

interface DisplayTextPartCue { type: "cue"; display: string }
interface DisplayTextPartText { type: "text"; startIndex: number; length: number; tokens: string[] }
type DisplayTextPart = DisplayTextPartCue | DisplayTextPartText;
interface DisplayLine { character: string; isNarrator: boolean; parts: DisplayTextPart[]; startIndex: number; length: number }

export const FormattedTextDisplay = React.memo(function FormattedTextDisplay({ words, displayLines, currentTime, characterColors, onWordClick }: FormattedTextDisplayProps) {
    
	const [autoScroll, setAutoScroll] = useState(true);
	const isAutoScrollingRef = useRef(false);
	const lastScrolledIndexRef = useRef<number | null>(null);
	const lastAutoScrollAtRef = useRef<number>(0);
	const resumeBtnRef = useRef<HTMLButtonElement | null>(null);
	const lastScrollYRef = useRef<number>(0);

    
	const contentRef = useRef<HTMLDivElement | null>(null);

    
	const [highlightStyle, setHighlightStyle] = useState<{
		x: number; y: number; width: number; height: number; visible: boolean; word: string;
	}>({ x: 0, y: 0, width: 0, height: 0, visible: false, word: "" });

    
	const currentWordIndex = useMemo(() => {
		if (!words || words.length === 0) return -1;
        
		let lo = 0, hi = words.length - 1, ans = -1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (words[mid].startTime <= currentTime) {
				ans = mid;
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		return ans;
	}, [words, currentTime]);

    
	function getDisplayTokenForIndex(idx: number): string {
		if (idx < 0) return "";
		for (const line of displayLines) {
			for (const part of line.parts) {
				if (part.type === "text") {
					const start = part.startIndex;
					const end = start + part.length;
					if (idx >= start && idx < end) {
						const j = idx - start;
						return part.tokens[j] ?? words[idx]?.text ?? "";
					}
				}
			}
		}
		return words[idx]?.text ?? "";
	}

    
	function updateOverlayPosition(idx: number) {
		const container = contentRef.current;
		if (!container) return;
		if (idx == null || idx < 0) {
			setHighlightStyle((h) => ({ ...h, visible: false }));
			return;
		}
		const el = document.querySelector<HTMLElement>(`[data-word-index="${idx}"]`);
		if (!el) {
			setHighlightStyle((h) => ({ ...h, visible: false }));
			return;
		}
		const wordRect = el.getBoundingClientRect();
		const contRect = container.getBoundingClientRect();
		const padX = 6;
		const padY = 2;
		const next = {
			x: Math.round(wordRect.left - contRect.left - padX),
			y: Math.round(wordRect.top - contRect.top - padY),
			width: Math.round(wordRect.width + padX * 2),
			height: Math.round(wordRect.height + padY * 2),
			visible: currentTime > 0,
			word: getDisplayTokenForIndex(idx),
		};
		setHighlightStyle((prev) => {
			const near = (a: number, b: number) => Math.abs(a - b) <= 1;
			if (
				prev.visible === next.visible &&
				prev.word === next.word &&
				near(prev.x, next.x) && near(prev.y, next.y) && near(prev.width, next.width) && near(prev.height, next.height)
			) {
				return prev;
			}
			return next;
		});
	}

    
	function scrollToIndex(index: number) {
		if (index == null || index < 0) return;
		const el = document.querySelector<HTMLElement>(`[data-word-index="${index}"]`);
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const currentY = window.scrollY || window.pageYOffset || 0;
        
		const bottomOffset = window.matchMedia('(min-width: 1024px)').matches ? 160 : 128;
		const effectiveHeight = Math.max(240, window.innerHeight - bottomOffset);
		const targetY = Math.max(0, currentY + rect.top - Math.round(effectiveHeight * 0.42));
		isAutoScrollingRef.current = true;
		lastAutoScrollAtRef.current = Date.now();
		window.scrollTo({ top: targetY, behavior: 'smooth' });
		window.setTimeout(() => {
			isAutoScrollingRef.current = false;
		}, 1000);
		lastScrolledIndexRef.current = index;
	}

    
	useEffect(() => {
		if (!autoScroll) return;
		if (currentWordIndex < 0) return;
		if (lastScrolledIndexRef.current === currentWordIndex) return;
		scrollToIndex(currentWordIndex);
	}, [currentWordIndex, autoScroll]);

    
	useEffect(() => {
		updateOverlayPosition(currentWordIndex);
		const onScrollOrResize = () => updateOverlayPosition(currentWordIndex);
		window.addEventListener('scroll', onScrollOrResize, { passive: true });
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onScrollOrResize);
			window.removeEventListener('resize', onScrollOrResize);
		};
	}, [currentWordIndex, displayLines, words, currentTime]);

    
	useEffect(() => {
		const pause = () => setAutoScroll(false);

		const onWheel = () => pause();
		const onKeyDown = (e: KeyboardEvent) => {
			const keys = ['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'];
			if (keys.includes(e.key)) pause();
		};
		const onTouchStart = (e: TouchEvent) => {
			const btn = resumeBtnRef.current;
			if (btn && e.target instanceof Node && btn.contains(e.target)) return;
			pause();
		};
		const onScroll = () => {
			if (isAutoScrollingRef.current) return;
			if (Date.now() - lastAutoScrollAtRef.current < 1200) return;
            
			const currentY = window.scrollY || window.pageYOffset || 0;
			const lastY = lastScrollYRef.current || 0;
			const delta = Math.abs(currentY - lastY);
			lastScrollYRef.current = currentY;
			if (delta < 8) return;
			pause();
		};

		window.addEventListener('wheel', onWheel, { passive: true });
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('scroll', onScroll);
		};
	}, []);

	const renderDialogueLine = (line: DisplayLine) => {
		const isNarrator = line.isNarrator || line.character === "Narrator";
		const characterGradient = characterColors[line.character] || "from-slate-500 to-slate-600";

        
		const hasCurrentWord = line.parts.some((p) =>
			p.type === "text" && currentWordIndex >= p.startIndex && currentWordIndex < p.startIndex + p.length,
		);

		return (
			<motion.div
				key={`line-${line.startIndex}`}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
				className={`
					group flex gap-2 sm:gap-4 py-2 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30
					${hasCurrentWord ? "bg-slate-50 dark:bg-slate-800/40" : ""}
					relative overflow-hidden
				`}
			>
				{/* Active line translucent overlay and accent (distinct from word overlay) */}
				{hasCurrentWord && (
					<>
						<div className="pointer-events-none absolute inset-0 rounded-lg bg-slate-200/40 dark:bg-slate-700/30" />
						<div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${characterGradient} opacity-70`} />
					</>
				)}
				{/* Name/icon */}
				<div className="relative z-10 flex-shrink-0 min-w-0 w-8 sm:w-24">
					{isNarrator ? (
						<>
							<div className="flex sm:hidden items-center justify-center h-6 w-8">
								<BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
							</div>
							<div className="hidden sm:flex items-center justify-center h-6">
								<BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
							</div>
						</>
					) : (
						<>
							<div className="flex sm:hidden items-center justify-center h-6 w-8">
								<div
									className={`w-6 h-6 rounded-full bg-gradient-to-r ${characterGradient} flex items-center justify-center text-white text-xs font-semibold shadow-sm`}
								>
									{line.character.charAt(0).toUpperCase()}
								</div>
							</div>
							<div className="hidden sm:flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full bg-gradient-to-r ${characterGradient} flex-shrink-0`}
								/>
								<span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
									{line.character}
								</span>
							</div>
						</>
					)}
				</div>

				{/* Dialogue (inline flow) */}
				<div className="relative z-10 flex-1 min-w-0">
					<div className="leading-relaxed break-words whitespace-pre-wrap">
						{line.parts.map((part, i) => {
							if (part.type === "cue") {
								return (
									<React.Fragment key={`cue-${line.startIndex}-${i}`}>
										<span className="italic opacity-40 px-0.5">({part.display})</span>{' '}
									</React.Fragment>
								);
							}

							return (
								<span key={`segment-${line.startIndex}-${i}`}>
									{part.tokens.map((tok, j) => {
										const idx = part.startIndex + j;
										const handleClick = () => {
											const t = words[idx]?.startTime ?? 0;
                                            
											const normTok = normalizeToken(tok);
											const normTiming = normalizeToken(words[idx]?.text ?? "");
											let adjustedIdx = idx;
											if (normTok && normTok !== normTiming) {
												const min = line.startIndex;
												const max = line.startIndex + line.length;
												adjustedIdx = findNearestMatchingIndex(words, idx, tok, min, max);
											}
											const target = words[adjustedIdx] ?? words[idx];
											onWordClick?.(target?.startTime ?? t, adjustedIdx);
										};
										return (
											<React.Fragment key={`word-${idx}`}>
												<span
													className={`inline px-0.5 py-0.5 rounded-sm cursor-pointer transition-colors duration-150 hover:bg-slate-200/60 dark:hover:bg-slate-700/40 ${
														isNarrator ? "text-slate-600 dark:text-slate-400" : "text-slate-700 dark:text-slate-300"
													}`}
													data-word-index={idx}
													onClick={handleClick}
												>
													{tok}
												</span>{' '}
											</React.Fragment>
										);
									})}
								</span>
							);
						})}
					</div>
				</div>
			</motion.div>
		);
	};

	function normalizeToken(s: string): string {
		return s
			.replace(/[“”]/g, '"')
			.replace(/[‘’]/g, "'")
			.replace(/^[^\w]+|[^\w]+$/g, '')
			.toLowerCase();
	}

	function findNearestMatchingIndex(all: Word[], guess: number, displayTok: string, minIdx = 0, maxIdx = all.length): number {
		const norm = normalizeToken(displayTok);
		if (!norm) return guess;
        
		const offsets: number[] = [0, 1, -1, 2, -2, 3, -3];
		for (const d of offsets) {
			const k = guess + d;
			if (k < minIdx || k >= maxIdx) continue;
			const cand = normalizeToken(all[k].text);
			if (cand === norm) return k;
		}
		return guess;
	}

	const progress = currentWordIndex >= 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;

	return (
		<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
			{/* Card container to match the Characters box design */}
			<div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/50 shadow-lg">
				{/* Header inside the card */}
				<div className="w-full p-4 sm:p-5">
					<div className="flex items-center gap-3">
						<div className="relative">
							<div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl blur-sm opacity-20"></div>
							<div className="relative p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg">
								<Play className="w-5 h-5 text-white" />
							</div>
						</div>
						<div className="flex-1">
							<h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 text-[22px]">Live Audio</h2>
						</div>
						<div className="text-right">
							<div className="text-sm font-medium text-slate-700 dark:text-slate-300">{Math.round(progress)}% complete</div>
							<div className="text-xs text-slate-500 dark:text-slate-400">
								{currentWordIndex >= 0 ? `${currentWordIndex + 1} of ${words.length} words` : `Ready • ${words.length} words`}
							</div>
						</div>
					</div>
				</div>

				{/* Continuous page content (no inner scrolling container) */}
				<div ref={contentRef} className="relative px-4 pb-4 sm:px-5 sm:pb-5">
					{/* Overlay-based smooth word highlighter */}
					{(() => {
						const currentChar = words[currentWordIndex]?.character ?? undefined;
						const gradient = currentChar ? (characterColors[currentChar] ?? "from-slate-500 to-slate-600") : "from-slate-500 to-slate-600";
						return (
							<motion.div
								className="pointer-events-none absolute z-30"
								style={{ left: 0, top: 0 }}
								initial={{ opacity: 0 }}
								animate={{
									x: highlightStyle.x,
									y: highlightStyle.y,
									width: highlightStyle.width,
									height: highlightStyle.height,
									opacity: highlightStyle.visible ? 1 : 0,
								}}
								transition={{
									type: "spring",
									stiffness: 400,
									damping: 35,
									mass: 0.6,
									duration: highlightStyle.visible ? 0.15 : 0.1,
								}}
							>
								<div className={`w-full h-full rounded-md shadow-sm bg-gradient-to-r ${gradient}`} />
								<div className="absolute inset-0 flex items-center">
									<span className="px-1.5 text-white font-medium select-none">{highlightStyle.word}</span>
								</div>
							</motion.div>
						);
					})()}

					<div className="space-y-px text-base leading-relaxed">
						{displayLines.map(renderDialogueLine)}
					</div>
				</div>
			</div>
			{/* Floating resume auto-scroll button (appears when user has paused auto-scroll by scrolling) */}
			{!autoScroll && (
				<motion.button
					ref={resumeBtnRef}
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.9 }}
					transition={{ duration: 0.2 }}
					onClick={() => {
						setAutoScroll(true);
						scrollToIndex(currentWordIndex);
					}}
					className="fixed right-4 bottom-4 sm:bottom-6 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3 rounded-full shadow-lg border border-white/30 hover:shadow-xl focus:outline-none"
					aria-label="Resume auto scroll"
					title="Resume auto scroll"
				>
					<ChevronsDown className="w-5 h-5" />
				</motion.button>
			)}
		</motion.div>
	);
});