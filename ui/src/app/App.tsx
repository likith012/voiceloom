import { ThemeProvider } from "../components/ThemeProvider.tsx";
import AppContent from "./AppContent.tsx";

export default function App() {
	return (
		<ThemeProvider defaultTheme="system" storageKey="voiceloom.theme">
			<AppContent />
		</ThemeProvider>
	);
}
