import Link from "next/link";
import { categories } from "@/lib/data";
import styles from "./categories.module.css";

export function Categories() {
  return (
    <nav aria-label="Categorías">
      <ul className={styles.row}>
        {categories.map((cat) => (
          <li key={cat.href} className={styles.cell}>
            <Link href={cat.href} className={styles.link}>
              <span className={styles.name}>{cat.name}</span>
              <span className={styles.count}>{cat.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
