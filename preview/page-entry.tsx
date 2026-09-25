import { createRoot } from 'react-dom/client';
import '../styles/site.css';
import { HomePage } from '../components/site/HomePage';

createRoot(document.getElementById('root')!).render(<HomePage />);
(window as any).ready = true;
