"use client";

import { useState } from "react";
import styles from "./footer.module.css";

export function NewsletterForm() {
  const [sent, setSent] = useState(false);

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(e) => {
          // Todavía no hay endpoint: se avisa en vez de postear a un 404.
          // Cuando exista /api/newsletter, cambiar por un server action.
          e.preventDefault();
          setSent(true);
        }}
      >
        <label htmlFor="newsletter-email" className="srOnly">
          Tu correo electrónico
        </label>
        <input
          id="newsletter-email"
          className={styles.input}
          type="email"
          name="email"
          placeholder="tu@email.com"
          autoComplete="email"
          required
          disabled={sent}
        />
        <button type="submit" className={styles.submit} disabled={sent}>
          OK
          <span className="srOnly"> suscribirme al newsletter</span>
        </button>
      </form>

      <p className={styles.formNotice} role="status">
        {sent && "Todavía no estamos tomando suscripciones. Volvé pronto."}
      </p>
    </>
  );
}
