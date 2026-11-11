import { formspreeFormId } from './config/feedback'
import './feedback.css'

export default function Feedback() {
  const configured = /^[a-zA-Z0-9]+$/.test(formspreeFormId)

  return (
    <section className="feedback-page" aria-labelledby="feedback-title">
      <p className="eyebrow">Help shape DestinyDoku</p>
      <h1 id="feedback-title">Send feedback</h1>
      <p>Found a bug, spotted incorrect weapon data, or have an idea? Tell us about it. No account needed.</p>
      {!configured && <p className="feedback-notice" role="status">Feedback submissions will be available soon. Please check back later.</p>}
      <form className="feedback-form" action={configured ? `https://formspree.io/f/${formspreeFormId}` : undefined} method="POST"
        onSubmit={(event) => { if (!configured) event.preventDefault() }}>
        <input type="hidden" name="subject" value="DestinyDoku feedback" />
        <div className="feedback-honeypot" aria-hidden="true">
          <label>Leave this field empty<input name="_gotcha" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <fieldset disabled={!configured}>
          <label htmlFor="feedback-category">Category</label>
          <select id="feedback-category" name="category" required defaultValue="bug">
            <option value="bug">Bug report</option>
            <option value="weapon-data">Incorrect weapon data</option>
            <option value="feature">Feature request</option>
            <option value="other">Other feedback</option>
          </select>
          <label htmlFor="feedback-title-input">Title</label>
          <input id="feedback-title-input" name="title" required maxLength={150} placeholder="A short summary" />
          <label htmlFor="feedback-description">Description</label>
          <textarea id="feedback-description" name="message" required maxLength={6000} rows={7} placeholder="What happened, or what would you like to see? For bugs, include the game mode and steps to reproduce the problem." />
          <label htmlFor="feedback-email">Email <span>(optional)</span></label>
          <input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="Only if you’d like a reply" aria-describedby="feedback-privacy" />
          <p id="feedback-privacy" className="feedback-privacy">Your message and optional email are sent through Formspree to the DestinyDoku maintainer. Please avoid sharing sensitive information.</p>
          <button type="submit">Send feedback</button>
        </fieldset>
      </form>
      <a className="back-link" href="#/">← All games</a>
    </section>
  )
}
