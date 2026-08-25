"use client";

import { useState } from "react";
import styles from "./account-view.module.css";

type Mode = "ingresar" | "crear";

/** El número llega por props: acá no se puede leer la base. */
export function AccountView({ whatsapp }: { whatsapp: string }) {
  const [mode, setMode] = useState<Mode>("ingresar");
  const [sent, setSent] = useState(false);

  const waHref = `https://wa.me/${whatsapp}`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Cuenta</p>
        <h1 className={styles.title}>
          {mode === "ingresar" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}
        </h1>
        <p className={styles.lede}>
          Para ver tus pedidos, tus datos de envío y tus beneficios de socio.
        </p>
      </header>

      <div className={styles.card}>
        <div className={styles.tabs} role="tablist" aria-label="Ingresar o crear cuenta">
          {(["ingresar", "crear"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`${styles.tab} ${mode === m ? styles.tabActive : ""}`}
              onClick={() => {
                setMode(m);
                setSent(false);
              }}
            >
              {m === "ingresar" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            // Todavía no hay backend de autenticación: en vez de simular un
            // ingreso que no existe, se avisa y se ofrece WhatsApp.
            e.preventDefault();
            setSent(true);
          }}
        >
          {mode === "crear" && (
            <div className={styles.field}>
              <label htmlFor="nombre" className={styles.label}>
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="name"
                className={styles.input}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "crear" ? "new-password" : "current-password"
              }
              className={styles.input}
              required
              minLength={8}
            />
          </div>

          <button type="submit" className={`btn btnGold ${styles.submit}`}>
            {mode === "ingresar" ? "Ingresar" : "Crear cuenta"}
          </button>

          <p className={styles.notice} role="status">
            {sent && (
              <>
                Las cuentas todavía no están habilitadas. Mientras tanto,
                escribinos por{" "}
                <a
                  href={waHref}
                  className={styles.noticeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>{" "}
                y te damos una mano con tu pedido.
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
