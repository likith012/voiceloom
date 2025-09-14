import React from "react";
import ThemeToggle from "./ThemeToggle";
import { motion } from "motion/react";
import { AudioWaveform, Activity } from "lucide-react";

interface HeaderProps {
	jobId?: string;
	jobState?: 'PENDING' | 'SYNTHESIZING' | 'ALIGNING' | 'READY' | 'FAILED';
}

export const Header = React.memo(function Header({ jobId, jobState }: HeaderProps) {
	const getStatusColor = () => {
		switch (jobState) {
			case 'PENDING':
				return 'text-yellow-600 dark:text-yellow-400';
			case 'SYNTHESIZING':
			case 'ALIGNING':
				return 'text-blue-600 dark:text-blue-400';
			case 'READY':
				return 'text-green-600 dark:text-green-400';
			case 'FAILED':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-slate-500 dark:text-slate-400';
		}
	};

	const getStatusText = () => {
		switch (jobState) {
			case 'PENDING':
				return 'Queued';
			case 'SYNTHESIZING':
				return 'Synthesizing';
			case 'ALIGNING':
				return 'Aligning';
			case 'READY':
				return 'Ready';
			case 'FAILED':
				return 'Failed';
			default:
				return 'Idle';
		}
	};

	return (
		<motion.header
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.6 }}
			className="sticky top-0 z-40 w-full border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl"
		>
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo and Brand */}
					<div className="flex items-center gap-3">
						<div className="relative">
							<div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-20"></div>
							<div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-2.5 rounded-xl">
								<AudioWaveform className="w-5 h-5 text-white" />
							</div>
						</div>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
								VoiceLoom
							</h1>
						</div>
					</div>

					{/* Status and Controls */}
					<div className="flex items-center gap-4">
						{/* Job Status */}
						{jobId && (
							<motion.div
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/50 dark:border-slate-700/50"
							>
								<Activity className={`w-3 h-3 ${getStatusColor()}`} />
								<span className="text-sm font-medium text-slate-700 dark:text-slate-300">
									{jobId.substring(0, 8)}
								</span>
								<div className="w-1 h-4 bg-slate-300 dark:bg-slate-600 rounded-full" />
								<span className={`text-sm font-medium ${getStatusColor()}`}>
									{getStatusText()}
								</span>
							</motion.div>
						)}

						{/* Mobile Status (simplified) */}
						{jobId && (
							<motion.div
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								className="sm:hidden flex items-center gap-2 px-2 py-1 bg-slate-50/80 dark:bg-slate-800/80 rounded-lg border border-slate-200/50 dark:border-slate-700/50"
							>
								<Activity className={`w-3 h-3 ${getStatusColor()}`} />
								<span className={`text-xs font-medium ${getStatusColor()}`}>
									{getStatusText()}
								</span>
							</motion.div>
						)}

						{/* Theme Toggle */}
						<ThemeToggle />
					</div>
				</div>
			</div>
		</motion.header>
	);
});