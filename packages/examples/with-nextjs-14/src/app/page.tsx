import { Widget } from "@/app/widget";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <Widget />
      </div>
    </main>
  );
}
