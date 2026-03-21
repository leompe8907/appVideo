import { Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { HomeShellContent } from '../components/ads/HomeShellContent';
import '../styles/pages/_home-shell.scss';

export function HomePlaceholderPage({ title, description }) {
  return (
    <section className="home-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function HomePage() {
  const { pathname } = useLocation();

  if (pathname === '/home') {
    return <Navigate to="/home/bouquets" replace />;
  }

  return (
    <div className="home-shell">
      <Sidebar />
      <main className="home-content">
        <HomeShellContent />
      </main>
    </div>
  );
}

export default HomePage;

