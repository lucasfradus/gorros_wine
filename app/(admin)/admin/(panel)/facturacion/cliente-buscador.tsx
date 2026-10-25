"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ClienteParaFacturar } from "./receptor-campos";
import styles from "../../admin.module.css";
import propios from "./facturacion.module.css";

const MAXIMO = 8;

/** Sin tildes ni mayúsculas: "Pérez" se encuentra tipeando "perez". */
const plano = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digitos = (s: string) => s.replace(/\D/g, "");

/**
 * Busca por nombre, apodo, razón social o CUIT/DNI. Con 3 dígitos o más,
 * también por documento, con o sin guiones: "20-1234" y "201234" encuentran lo
 * mismo.
 */
export function filtrarClientes(clientes: ClienteParaFacturar[], texto: string) {
  const q = plano(texto.trim());
  if (!q) return [];
  const qDigitos = digitos(q);
  return clientes
    .filter(
      (c) =>
        [c.nombre, c.apodo, c.razonSocial].some((v) => v && plano(v).includes(q)) ||
        (qDigitos.length >= 3 && !!c.documento && digitos(c.documento).includes(qDigitos)),
    )
    .slice(0, MAXIMO);
}

export const etiquetaCliente = (c: ClienteParaFacturar) => c.razonSocial ?? c.nombre;

/**
 * Combobox de clientes (patrón ARIA "combobox con listbox"): flechas para
 * moverse, Enter para elegir, Escape para cerrar. Enter no envía la factura
 * mientras la lista está abierta. Con uno elegido, muestra quién es y deja
 * cambiarlo.
 */
export function ClienteBuscador({
  clientes,
  elegido,
  onElegir,
}: {
  clientes: ClienteParaFacturar[];
  elegido: ClienteParaFacturar | null;
  onElegir: (c: ClienteParaFacturar | null) => void;
}) {
  const base = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const opciones = useMemo(() => filtrarClientes(clientes, texto), [clientes, texto]);
  const visible = abierto && texto.trim() !== "";
  // Al tocar "Cambiar" el botón desaparece: el foco va al buscador en vez de
  // perderse, para seguir con el teclado.
  const input = useRef<HTMLInputElement>(null);
  const enfocar = useRef(false);
  useEffect(() => {
    if (!elegido && enfocar.current) {
      enfocar.current = false;
      input.current?.focus();
    }
  }, [elegido]);

  function elegir(c: ClienteParaFacturar) {
    onElegir(c);
    setTexto("");
    setAbierto(false);
  }

  if (elegido) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>Cliente</span>
        <div className={propios.clienteElegido}>
          <span>
            <span className={styles.cellName}>{etiquetaCliente(elegido)}</span>
            <span className={styles.cellDim}>
              {[elegido.apodo, elegido.documento].filter(Boolean).join(" · ") || "Sin documento"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              enfocar.current = true;
              onElegir(null);
            }}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${base}-q`}>
        Cliente
      </label>
      <div className={propios.buscador}>
        <input
          ref={input}
          id={`${base}-q`}
          role="combobox"
          aria-expanded={visible && opciones.length > 0}
          aria-controls={`${base}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={visible && opciones[activo] ? `${base}-${activo}` : undefined}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setAbierto(false)}
          onKeyDown={(e) => {
            if (!visible) {
              if (e.key === "ArrowDown" && texto.trim()) setAbierto(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((i) => Math.min(i + 1, opciones.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (opciones[activo]) elegir(opciones[activo]);
            } else if (e.key === "Escape") {
              setAbierto(false);
            }
          }}
          placeholder="Nombre, apodo, razón social o CUIT/DNI"
          autoComplete="off"
          className={styles.input}
        />
        {visible && opciones.length === 0 ? (
          // Fuera del listbox (que sólo admite opciones), y anunciado.
          <p className={`${propios.opciones} ${propios.sinOpciones}`} role="status">
            No hay un cliente así. Cargá los datos abajo y queda guardado.
          </p>
        ) : null}
        {visible && opciones.length > 0 ? (
          <ul id={`${base}-lista`} role="listbox" className={propios.opciones}>
            {opciones.map((c, i) => (
                <li
                  key={c.id}
                  id={`${base}-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  className={`${propios.opcion} ${i === activo ? propios.opcionActiva : ""}`}
                  // mousedown y no click: el click llega después del blur, que ya cerró la lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(c);
                  }}
                  onMouseEnter={() => setActivo(i)}
                >
                  <span className={styles.cellName}>{etiquetaCliente(c)}</span>
                  <span className={styles.cellDim}>
                    {[c.razonSocial && c.nombre !== c.razonSocial ? c.nombre : null, c.apodo, c.documento]
                      .filter(Boolean)
                      .join(" · ") || "Sin documento"}
                  </span>
                </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className={styles.hint}>O dejalo vacío y cargá los datos a mano.</span>
    </div>
  );
}
