# Gym House 2.0 - Vercel Deployment

## 🚀 Deploy su Vercel

### Prerequisiti

1. **Account Vercel** - Crea un account su [vercel.com](https://vercel.com)
2. **GitHub** - Collega il tuo repository GitHub a Vercel
3. **Vercel Postgres** - Crea un database Postgres su Vercel
4. **Vercel Blob** (opzionale) - Per upload video
5. **Gemini API Key** - Ottieni la chiave da [Google AI Studio](https://makersuite.google.com/app/apikey)

### Configurazione Environment Variables

In Vercel Dashboard → Settings → Environment Variables, aggiungi:

```
GEMINI_API_KEY=la_tua_chiave_gemini
YOUTUBE_API_KEY=la_tua_chiave_youtube (opzionale)
ADMIN_EMAIL=emobtemo@gmail.com
BLOB_READ_WRITE_TOKEN=token_vercel_blob (per upload video)
POSTGRES_URL=vercel_postgres_url (auto-generato da Vercel)
```

### Setup Database

1. Vai su Vercel Dashboard → Storage → Postgres
2. Clicca "Continue" per creare il database
3. Vai alla tab "Query" ed esegui il contenuto di `schema.sql`
4. Oppure usa psql:
   ```bash
   vercel postgres connect
   # Poi incolla il contenuto di schema.sql
   ```

### Deploy

1. Push del codice su GitHub
2. Vai su Vercel Dashboard → "Add New Project"
3. Importa il repository GitHub
4. Vercel rileverà automaticamente la configurazione
5. Clicca "Deploy"

### Comandi Locali

```bash
# Installa dipendenze
npm install

# Sviluppo locale
vercel dev

# Build
vercel build

# Deploy
vercel --prod
```

### Funzionalità

- ✅ Dieta AI con Gemini
- ✅ Tracker Sgarri (Cheat Meals)
- ✅ Scheda Allenamento AI
- ✅ Check-In GPS
- ✅ QR Code
- ✅ Piani salvati per utente
- ⚠️ WebSocket sostituito con polling (Vercel limitation)
- ⚠️ Upload video richiede Vercel Blob configurato

### Note Importanti

- **WebSocket non supportato** su Vercel, sostituito con polling ogni 5 secondi
- **File system non persistente**, tutti i dati salvati in Vercel Postgres
- **Upload video** richiede Vercel Blob configurato
- **API Keys** devono essere configurate nelle Environment Variables

### Troubleshooting

Se hai problemi:
1. Verifica che tutte le Environment Variables siano impostate
2. Controlla che il database sia stato inizializzato con schema.sql
3. Verifica le log in Vercel Dashboard per errori
4. Assicurati che @vercel/postgres sia installato correttamente
