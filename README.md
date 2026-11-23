# KUHO – hlasování o filmech

Jednoduchá aplikace pro filmový víkend: kamarádi nominují filmy, pak hlasují (kladné / záporné hlasy) a nakonec se vyhlásí výsledky.

- Produkce: https://kuho-voting.vercel.app/ (Vercel, nasazuje se z GitHubu)
- Databáze: Firebase projekt `kuho-voting` (Firestore + anonymní Authentication)
- Stack: Next.js 16, React 19, Tailwind 4, Firebase JS SDK 12

## Jak to funguje

- **Přihlášení = přezdívka.** Žádná hesla. Na pozadí má každý prohlížeč anonymní Firebase session
  (kvůli bezpečnostním pravidlům), ale identita hráče je přezdívka. Stejná přezdívka na jiném
  zařízení = stejný hráč (velikost písmen a diakritika se ignorují: „Pepa“ = „pépa“).
- **Ročníky.** Každý rok je samostatný ročník (`editions/{rok}`) s vlastními filmy, hlasy a fází.
  Starší ročníky jsou v archivu a dají se prohlížet přes přepínač „Ročník“ v hlavičce.
- **Fáze:** Nominace → Hlasování → Výsledky. Přepíná je admin.
- **Admin** se přihlásí PINem v patičce („Administrace“). PIN je uložen ve Firestore v dokumentu
  `secrets/admin` (pole `pin`), který aplikace nikdy nepřečte – ověřují ho jen bezpečnostní pravidla.

## Datový model (Firestore)

| Cesta | Obsah |
| --- | --- |
| `config/app_state` | `currentEdition` – který ročník je aktuální |
| `editions/{rok}` | `name, year, phase, archived, plusVotes, minusVotes, winners` |
| `editions/{rok}/movies/{id}` | `title, link, comment, nominator, nominatorKey, createdAt` |
| `editions/{rok}/votes/{hráč}` | `name, plus[], minus[], updatedAt` |
| `players/{hráč}` | `name, createdAt` |
| `admins/{uid}` | přihlášení admini (PIN ověřen pravidly) |
| `secrets/admin` | `pin` – zakládá se ručně v konzoli |
| `movies`, `votes` | stará data z 2025 (původní formát), jen pro čtení jako záloha |

Bezpečnostní pravidla jsou v [`firestore.rules`](firestore.rules) – hlídají fáze (nominovat jde jen
v nominaci, hlasovat jen v hlasování), limity hlasů a zamykají archivované ročníky.

## Každoroční postup

1. Admin → „Založit nový ročník“ (např. 2027) – rovnou se nastaví jako aktuální.
2. Během víkendu přepínej fáze Nominace → Hlasování → Výsledky.
3. Po akci „Archivovat ročník“.

## Vývoj

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Proměnné prostředí (`.env.local`, na Vercelu v Project Settings → Environment Variables):
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

### Nasazení pravidel Firestore

Buď ručně: Firebase Console → Firestore Database → Rules → vložit obsah `firestore.rules` → Publish.
Nebo z příkazové řádky:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

### Ve Firebase musí být zapnuto

- Authentication → Sign-in method → **Anonymous** (Google přihlášení už aplikace nepoužívá, může se vypnout).
