import { benefits } from "@/lib/data";
import styles from "./benefits.module.css";

export function Benefits() {
  return (
    <ul className={styles.row}>
      {benefits.map((b) => (
        <li key={b.label} className={styles.cell}>
          <p className={styles.label}>{b.label}</p>
          <p className={styles.body}>{b.body}</p>
        </li>
      ))}
    </ul>
  );
}
