import { SITE } from '../../logic/site.js'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>MIT · Vyra</span>
        <a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
          github.com/{SITE.repo}
        </a>
      </div>
    </footer>
  )
}
