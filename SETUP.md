# 🗄️ SQL Builder — Guia de Configuração Completo

Siga **exatamente** esta ordem. Leva cerca de 20 minutos.

---

## PARTE 1 — Criar conta e projeto no Supabase

### 1.1 Criar conta
1. Acesse **https://supabase.com** e clique em **Start your project**
2. Faça login com sua conta GitHub (mais fácil)
3. Clique em **New project**
4. Preencha:
   - **Name:** `sql-builder-game`
   - **Database Password:** anote essa senha!
   - **Region:** South America (São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

---

### 1.2 Criar a tabela de pontuações

1. No painel do Supabase, clique em **SQL Editor** (ícone de banco no menu esquerdo)
2. Clique em **New query**
3. Cole e execute o SQL abaixo:

```sql
-- Tabela de pontuações
CREATE TABLE scores (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL,
  theme      TEXT NOT NULL,
  username   TEXT NOT NULL,
  avatar_url TEXT,
  points     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, theme)
);

-- Índice para busca rápida por tema
CREATE INDEX idx_scores_theme ON scores(theme);

-- Habilitar Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode LER o placar
CREATE POLICY "Placar público"
  ON scores FOR SELECT
  USING (true);

-- Usuário só pode gravar/atualizar o próprio score
CREATE POLICY "Usuário grava próprio score"
  ON scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza próprio score"
  ON scores FOR UPDATE
  USING (auth.uid() = user_id);
```

4. Clique em **Run** — deve aparecer "Success"

---

### 1.3 Pegar as chaves da API

1. No menu esquerdo clique em **Settings** (engrenagem) → **API**
2. Anote dois valores:
   - **Project URL** → algo como `https://xyzxyz.supabase.co`
   - **anon / public key** → string longa começando com `eyJ...`

---

## PARTE 2 — Configurar GitHub OAuth no Supabase

### 2.1 Criar OAuth App no GitHub

1. Acesse **https://github.com/settings/developers**
2. Clique em **OAuth Apps** → **New OAuth App**
3. Preencha:
   - **Application name:** `SQL Builder Game`
   - **Homepage URL:** `https://SEU_USUARIO.github.io/sql-builder-game`
     *(substitua SEU_USUARIO pelo seu usuário do GitHub)*
   - **Authorization callback URL:**
     `https://SEU_PROJETO.supabase.co/auth/v1/callback`
     *(substitua SEU_PROJETO pelo ID do seu projeto Supabase — veja na URL do painel)*
4. Clique em **Register application**
5. Na próxima tela, anote o **Client ID**
6. Clique em **Generate a new client secret** e anote o **Client Secret**

### 2.2 Habilitar GitHub no Supabase

1. No painel Supabase: **Authentication** → **Providers**
2. Clique em **GitHub** para expandir
3. Ative o toggle **Enable GitHub provider**
4. Cole o **Client ID** e **Client Secret** do passo anterior
5. Clique em **Save**

### 2.3 Configurar URL permitida no Supabase

1. No painel Supabase: **Authentication** → **URL Configuration**
2. Em **Site URL** coloque:
   `https://SEU_USUARIO.github.io/sql-builder-game`
3. Em **Redirect URLs** adicione:
   `https://SEU_USUARIO.github.io/sql-builder-game`
4. Clique em **Save**

---

## PARTE 3 — Configurar o arquivo config.js

Abra o arquivo `config.js` e substitua os valores:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',  // a chave anon longa
};
```

---

## PARTE 4 — Publicar no GitHub Pages

### 4.1 Criar repositório

1. Acesse **https://github.com/new**
2. **Repository name:** `sql-builder-game`
3. Marque **Public**
4. Clique em **Create repository**

### 4.2 Fazer upload dos arquivos

**Opção A — pelo navegador (mais fácil):**
1. No repositório criado, clique em **Add file** → **Upload files**
2. Arraste os 5 arquivos:
   - `index.html`
   - `config.js`
   - `questions.js`
   - `app.js`
   - `supabase.js`
3. Clique em **Commit changes**

**Opção B — pelo terminal:**
```bash
git clone https://github.com/SEU_USUARIO/sql-builder-game
cd sql-builder-game
# copie os arquivos para esta pasta
git add .
git commit -m "primeiro deploy"
git push
```

### 4.3 Ativar GitHub Pages

1. No repositório, clique em **Settings**
2. No menu esquerdo, clique em **Pages**
3. Em **Source**, selecione **Deploy from a branch**
4. Em **Branch**, selecione **main** e pasta **/ (root)**
5. Clique em **Save**
6. Aguarde 1-2 minutos e acesse:
   `https://SEU_USUARIO.github.io/sql-builder-game`

---

## PARTE 5 — Testar

1. Acesse o link do GitHub Pages
2. Clique em **Entrar com GitHub**
3. Autorize o aplicativo
4. Você deve ver a tela de menu com os temas
5. Escolha um tema e jogue!
6. Após terminar, verifique no Supabase → **Table Editor** → **scores** se a pontuação foi salva

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Tela branca ao abrir | Verifique o console do browser (F12) — provavelmente as chaves do config.js estão erradas |
| Botão GitHub não redireciona | Verifique se o Client ID/Secret estão corretos no Supabase |
| Após login volta para tela de login | Verifique se a URL do site está configurada corretamente em Authentication → URL Configuration |
| Placar não salva | Verifique se as políticas RLS foram criadas corretamente no SQL Editor |

---

## Estrutura final dos arquivos

```
sql-builder-game/
├── index.html      ← interface do jogo
├── config.js       ← suas chaves (Supabase URL e anon key)
├── questions.js    ← banco de questões por tema
├── app.js          ← lógica do jogo + auth + placar
└── supabase.js     ← biblioteca do Supabase (já incluída)
```

---

**Após configurar tudo, compartilhe o link com os alunos:**
`https://SEU_USUARIO.github.io/sql-builder-game` 🚀
