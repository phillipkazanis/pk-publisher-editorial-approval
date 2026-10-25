import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/App.module.css';

// Branding is configured per environment and is not stored in the repo (see .env.example).
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Editorial Console';
const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';

const NAV = [
  { href: '/', label: 'Submit' },
  { href: '/revisions', label: 'Revisions' },
  { href: '/tasks', label: 'Editor tasks' },
  { href: '/admin', label: 'Admin' },
];

export default function Layout({ title, children }) {
  const { pathname } = useRouter();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className={styles.page}>
      <Head>
        <title>{`${BRAND_NAME} | ${title}`}</title>
      </Head>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            {BRAND_LOGO && !logoFailed ? (
              <img className={styles.logo} src={BRAND_LOGO} alt={BRAND_NAME} onError={() => setLogoFailed(true)} />
            ) : (
              <p className={styles.wordmark}>{BRAND_NAME}</p>
            )}
            <span className={styles.appName}>Editorial approval</span>
          </div>
          <span className={styles.envPill}>Demo environment</span>
        </div>
      </header>

      <nav className={styles.nav} aria-label="Views">
        <div className={styles.navInner}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ''}`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
