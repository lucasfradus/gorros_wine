import { getContent } from "@/lib/content/get";
import styles from "./benefits.module.css";

export async function Benefits() {
  const { beneficios } = await getContent("home");

  return (
    <ul className={styles.row}>
      {beneficios.map((b, i) => (
        <li key={i} className={styles.cell}>
          <p className={styles.label}>{b.label}</p>
          <p className={styles.body}>{b.body}</p>
        </li>
      ))}
    </ul>
  );
}
