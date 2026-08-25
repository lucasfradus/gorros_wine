"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientes, movimientosCc } from "@/lib/db/schema";
import { normalizeEmail } from "@/lib/auth/password";
import { canManageCuentaCorriente, requireUser } from "@/lib/auth";
import { importeACentavos } from "@/lib/cuenta-corriente";

export interface ClienteFormState {
  error?: string;
  ok?: string;
}

/**
 * Los datos del cliente. La plata de la cuenta corriente **no se toca desde
 * acá**: vive en `cuenta-actions.ts`, que exige otro permiso. Un editor puede
 * corregir un teléfono sin enterarse de cuánto debe nadie.
 */

/** Vacío es "no lo cargó", no cadena vacía: en la base va `null`. */
function textoOpcional(valor: FormDataEntryValue | null): string | undefined {
  const s = typeof valor === "string" ? valor.trim() : "";
  return s === "" ? undefined : s;
}

const datosSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es muy corto."),
  apodo: z.string().trim().max(120, "El apodo es muy largo.").optional(),
  telefono: z.string().trim().max(60, "El teléfono es muy largo.").optional(),
  email: z.email("Escribí un mail válido.").optional(),
  documento: z.string().trim().max(40, "El documento es muy largo.").optional(),
  razonSocial: z
    .string()
    .trim()
    .max(160, "La razón social es muy larga.")
    .optional(),
  direccion: z.string().trim().max(240, "La dirección es muy larga.").optional(),
  notas: z.string().trim().max(2000, "Las notas son muy largas.").optional(),
  cuentaCorriente: z.boolean(),
});

type Datos = z.infer<typeof datosSchema>;

function leerDatos(formData: FormData) {
  return datosSchema.safeParse({
    nombre: formData.get("nombre"),
    apodo: textoOpcional(formData.get("apodo")),
    telefono: textoOpcional(formData.get("telefono")),
    email: textoOpcional(formData.get("email")),
    documento: textoOpcional(formData.get("documento")),
    razonSocial: textoOpcional(formData.get("razonSocial")),
    direccion: textoOpcional(formData.get("direccion")),
    notas: textoOpcional(formData.get("notas")),
    cuentaCorriente: formData.get("cuentaCorriente") === "on",
  });
}

/**
 * Un campo de plata opcional. Vacío es `null` —sin límite—, y basura es un
 * error que hay que mostrar: aceptarlo como cero convertiría un typo en "no
 * le fíes ni un peso".
 */
function leerImporteOpcional(
  formData: FormData,
  campo: string,
): number | null | "invalido" {
  const texto = textoOpcional(formData.get(campo));
  if (texto === undefined) return null;
  const centavos = importeACentavos(texto);
  if (centavos === null || centavos < 0) return "invalido";
  return centavos;
}

function aColumnas(datos: Datos) {
  return {
    nombre: datos.nombre,
    apodo: datos.apodo ?? null,
    telefono: datos.telefono ?? null,
    email: datos.email ? normalizeEmail(datos.email) : null,
    documento: datos.documento ?? null,
    razonSocial: datos.razonSocial ?? null,
    direccion: datos.direccion ?? null,
    notas: datos.notas ?? null,
    cuentaCorriente: datos.cuentaCorriente,
  };
}

/** ¿Hay otro cliente con ese mail? El de la propia fila no cuenta. */
async function mailOcupado(email: string, exceptoId?: string) {
  const [existente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.email, email))
    .limit(1);

  return existente ? existente.id !== exceptoId : false;
}

// ---------------------------------------------------------------- crear

export async function crearClienteAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const actor = await requireUser();

  const parsed = leerDatos(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limiteArs = leerImporteOpcional(formData, "limiteArs");
  const limiteUsd = leerImporteOpcional(formData, "limiteUsd");
  if (limiteArs === "invalido" || limiteUsd === "invalido") {
    return { error: "Revisá el límite de crédito: no se entiende ese importe." };
  }

  const columnas = aColumnas(parsed.data);
  if (columnas.email && (await mailOcupado(columnas.email))) {
    return { error: "Ya hay un cliente con ese mail." };
  }

  // El saldo con el que arranca sólo lo puede cargar quien maneja plata. Para
  // un editor los campos ni se dibujan, pero esto es lo que de verdad lo
  // frena: una Server Action es un endpoint y se puede llamar sin la pantalla.
  const puedePlata = canManageCuentaCorriente(actor);
  const debeArs = puedePlata ? leerImporteOpcional(formData, "debeArs") : null;
  const debeUsd = puedePlata ? leerImporteOpcional(formData, "debeUsd") : null;
  if (debeArs === "invalido" || debeUsd === "invalido") {
    return { error: "Revisá el saldo inicial: no se entiende ese importe." };
  }

  const id = await db.transaction(async (tx) => {
    const [creado] = await tx
      .insert(clientes)
      .values({
        ...columnas,
        limiteArsCentavos: limiteArs,
        limiteUsdCentavos: limiteUsd,
      })
      .returning({ id: clientes.id });

    // Lo que ya venía debiendo entra como un movimiento más y no como una
    // columna aparte: así el extracto arranca explicando de dónde sale el
    // saldo, en vez de empezar con un número sin origen.
    if (debeArs || debeUsd) {
      await tx.insert(movimientosCc).values({
        clienteId: creado.id,
        tipo: "saldo_inicial",
        detalle: "Saldo con el que se lo dio de alta",
        deltaArsCentavos: debeArs ? -debeArs : 0,
        deltaUsdCentavos: debeUsd ? -debeUsd : 0,
        grupoId: crypto.randomUUID(),
        creadoPor: actor.id,
      });
    }

    return creado.id;
  });

  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}`);
}

// ---------------------------------------------------------------- editar

export async function actualizarClienteAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const actor = await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Cliente inválido." };

  const parsed = leerDatos(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [objetivo] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.id, id.data))
    .limit(1);

  if (!objetivo) return { error: "Ese cliente ya no existe." };

  const columnas = aColumnas(parsed.data);
  if (columnas.email && (await mailOcupado(columnas.email, objetivo.id))) {
    return { error: "Ya hay otro cliente con ese mail." };
  }

  // El límite es plata: lo mueve sólo quien maneja la cuenta. Si no, se deja
  // el que ya estaba en vez de pisarlo con lo que venga en el formulario.
  const cambios: Record<string, unknown> = {
    ...columnas,
    updatedAt: new Date(),
  };

  if (canManageCuentaCorriente(actor)) {
    const limiteArs = leerImporteOpcional(formData, "limiteArs");
    const limiteUsd = leerImporteOpcional(formData, "limiteUsd");
    if (limiteArs === "invalido" || limiteUsd === "invalido") {
      return {
        error: "Revisá el límite de crédito: no se entiende ese importe.",
      };
    }
    cambios.limiteArsCentavos = limiteArs;
    cambios.limiteUsdCentavos = limiteUsd;
  }

  await db.update(clientes).set(cambios).where(eq(clientes.id, objetivo.id));

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${objetivo.id}`);
  return { ok: "Cambios guardados." };
}

// -------------------------------------------------------- archivar/reactivar

export async function archivarClienteAction(
  _prev: ClienteFormState,
  formData: FormData,
): Promise<ClienteFormState> {
  const actor = await requireUser();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Cliente inválido." };

  const [objetivo] = await db
    .select({ id: clientes.id, isActive: clientes.isActive })
    .from(clientes)
    .where(eq(clientes.id, id.data))
    .limit(1);

  if (!objetivo) return { error: "Ese cliente ya no existe." };

  await db
    .update(clientes)
    .set({ isActive: !objetivo.isActive, updatedAt: new Date() })
    .where(eq(clientes.id, objetivo.id));

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${objetivo.id}`);

  return {
    ok: objetivo.isActive
      ? "Cliente archivado. Su cuenta y su historial quedan intactos."
      : "Cliente reactivado.",
  };
}
