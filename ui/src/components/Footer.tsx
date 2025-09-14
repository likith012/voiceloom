import React from "react";
import { motion } from "motion/react";

export const Footer = React.memo(function Footer() {
	return (
		<motion.footer
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 1, duration: 0.6 }}
			className="mt-16 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
		>
			<div className="container mx-auto px-4 py-6">
				<p className="text-center text-xs text-slate-500 dark:text-slate-400">
					VoiceLoom © 2025 • Transform stories into professional audio
				</p>
			</div>
		</motion.footer>
	);
});