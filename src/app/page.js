import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>TriggerFeed V3.0</h1>
          <p>
            Let&apos;s do it right this time.
          </p>
        </div>
      </main>
    </div>
  );
}
