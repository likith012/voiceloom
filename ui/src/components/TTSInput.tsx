import { useState, memo, useCallback } from 'react';
import { Button } from './ui-kit/button';
import { Textarea } from './ui-kit/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui-kit/card';
import { Loader2, FileText, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface TTSInputProps {
	onSubmit: (structuredText: string) => void;
	isProcessing: boolean;
	isCollapsed: boolean;
}

export const TTSInput = memo(function TTSInput({ onSubmit, isProcessing, isCollapsed }: TTSInputProps) {
	const [structuredText, setStructuredText] = useState("");

	const handleSubmit = useCallback(() => {
		if (structuredText.trim()) {
			onSubmit(structuredText);
		}
	}, [structuredText, onSubmit]);

	if (isCollapsed) {
		return (
			<motion.div
				initial={{ opacity: 1, height: "auto" }}
				animate={{ opacity: 0.6, height: "auto" }}
				transition={{ duration: 0.3 }}
			>

			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
		>
			<Card className="w-full mb-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-slate-900/20">
				<CardHeader className="pb-4">
					<div className="flex items-center gap-4">
						<div className="relative">
							<div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-sm opacity-20"></div>
							<div className="relative p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
								<FileText className="w-5 h-5 text-white" />
							</div>
						</div>
						<div>
							<CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 text-[22px]">
								Synthesize
							</CardTitle>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					<div className="relative">
						<Textarea
							value={structuredText}
							onChange={(e) => setStructuredText(e.target.value)}
							placeholder="Enter your story here..."
							className="min-h-60 sm:min-h-80 font-mono text-sm bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
							disabled={isProcessing}
						/>
						{isProcessing && (
							<div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
								<div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
									<div className="flex items-center gap-3">
										<Loader2 className="w-5 h-5 animate-spin text-blue-600" />
										<div>
											<p className="font-medium text-slate-900 dark:text-slate-100">Processing your story</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					<motion.div
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
						transition={{ duration: 0.2 }}
					>
						<Button 
							onClick={handleSubmit} 
							disabled={isProcessing || !structuredText.trim()}
							className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium text-base shadow-lg shadow-blue-500/25 dark:shadow-blue-500/10 transition-all duration-200"
						>
							{isProcessing ? (
								<>
									<Loader2 className="w-5 h-5 mr-3 animate-spin" />
									Synthesizing
								</>
							) : (
								<>
									<Zap className="w-5 h-5 mr-3" />
									Generate Audio
								</>
							)}
						</Button>
					</motion.div>

					{/* Processing steps */}
					{isProcessing && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
						>
							<div className="flex items-center gap-3 mb-3">
								<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
								<span className="text-sm font-medium text-blue-700 dark:text-blue-300">Pipeline</span>
							</div>
							<div className="space-y-2 text-xs text-blue-600 dark:text-blue-400">
								<div className="flex items-center gap-2">
									<div className="w-1 h-1 bg-blue-400 rounded-full"></div>
									Parsing and normalizing your story
								</div>
								<div className="flex items-center gap-2">
									<div className="w-1 h-1 bg-blue-400 rounded-full"></div>
									Generating voice synthesis
								</div>
								<div className="flex items-center gap-2">
									<div className="w-1 h-1 bg-blue-400 rounded-full"></div>
									Aligning voice
								</div>
							</div>
						</motion.div>
					)}
				</CardContent>
			</Card>
		</motion.div>
	);
});