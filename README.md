# Mental Hashmap MVP

Primeiro MVP do app web para consulta do Mental Hashmap.

## Stack

- React
- TypeScript
- Vite
- JSON externo
- localStorage para cache
- sem backend
- sem banco de dados

## Funcionalidades

- Busca por **Intenção Mental**
- Busca por **English**
- Busca combinada
- Busca parcial
- Busca case-insensitive
- Busca accent-insensitive
- Listagem de todas as intenções
- Ordenação alfabética
- Contador de resultados
- Painel de detalhes
- Intenções relacionadas
- Loading
- Tratamento de erro
- Retry
- Cache local
- Fallback para cache se a fonte externa estiver indisponível

## 1. Pré-requisitos

Instale:

- Node.js 20+ recomendado
- npm
- Git opcional

Confira:

```bash
node --version
npm --version
```

## 2. Instalação

Dentro da pasta do projeto:

```bash
npm install
```

## 3. Rodar

```bash
npm run dev
```

Abra no navegador:

```text
http://localhost:5173
```

## 4. JSON usado no MVP

Por padrão, o projeto utiliza:

```text
/public/sample-hashmap.json
```

A configuração está no arquivo:

```text
.env
```

Atualmente:

```env
VITE_HASHMAP_URL=/sample-hashmap.json
```

## 5. Usar JSON do GitHub

Quando você publicar o arquivo no GitHub, copie a URL RAW.

Exemplo:

```text
https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/hashmap.json
```

Altere `.env`:

```env
VITE_HASHMAP_URL=https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/hashmap.json
```

Depois reinicie:

```bash
npm run dev
```

## 6. Estrutura esperada do JSON

```json
{
  "metadata": {
    "name": "Mental Hashmap",
    "version": "1.0.0",
    "updatedAt": "2026-09-11",
    "language": "pt-BR"
  },
  "mentalMap": [
    {
      "id": "used-to",
      "intention": "Eu costumava...",
      "english": "I used to...",
      "pattern": "used to + base verb",
      "description": "Expresses a past habit or situation that is no longer true.",
      "category": "past-habits",
      "searchTerms": [
        "costumava",
        "used to"
      ],
      "examples": [
        {
          "pt": "Eu costumava trabalhar aqui.",
          "en": "I used to work here."
        }
      ],
      "tags": [
        "past",
        "habit"
      ],
      "related": [
        "be-used-to"
      ]
    }
  ]
}
```

## 7. Build de produção

```bash
npm run build
```

O resultado ficará em:

```text
dist/
```

Para testar:

```bash
npm run preview
```

## 8. Próximos passos sugeridos

Depois de validar este MVP:

1. Publicar o JSON real no GitHub.
2. Adicionar todas as intenções do seu documento.
3. Melhorar o layout.
4. Adicionar áudio/pronúncia.
5. Adicionar favoritos.
6. Adicionar "já domino esta intenção".
7. Adicionar autenticação quando virar benefício do clube pago.

## Arquitetura

```text
GitHub / JSON
      |
      | HTTPS
      v
React + TypeScript
      |
      +-- Busca por intenção
      +-- Busca em inglês
      +-- Detalhes
      |
      v
localStorage
(cache)
```
