# specs/features/path-autolink.feature

Feature: Buddy paths in assistant text become labelled links (FR-CHAT-16)
  As a user who has never opened a terminal
  I want the files Buddy mentions to be things I can open
  So that a path is an offer to look, not a piece of trivia about directories

  # Buddy routinely names the file it touched — "Cambié tu perfil
  # agent_brain/identity/USER.md". Linking that string while still printing it
  # whole leaves the internal layout on screen; it only becomes clickable.

  Scenario: A brain path becomes a link labelled with the file name
    When the assistant says "Cambié tu perfil agent_brain/identity/USER.md"
    Then the rendered message links "agent_brain/identity/USER.md" labelled "USER.md"

  Scenario: A log path becomes a link labelled with the file name
    When the assistant says "Está en logs/2026-07-30.md"
    Then the rendered message links "logs/2026-07-30.md" labelled "2026-07-30.md"

  # The user's own space is the case where the path is the useful part: it is
  # what lets them find the file in Obsidian or a file manager.

  Scenario: A path in the user workspace keeps its full path as the label
    When the assistant says "Lo añadí a user/inbox.md"
    Then the rendered message links "user/inbox.md" labelled "user/inbox.md"

  Scenario: A downloaded file keeps its full path as the label
    When the assistant says "Guardado en downloads/2026-07-30_article.md"
    Then the rendered message links "downloads/2026-07-30_article.md" labelled "downloads/2026-07-30_article.md"

  # --- Never a link inside a link (FR-CHAT-16) ---

  Scenario: A path the agent already linked is left alone
    When the assistant says "Mira [mi perfil](agent_brain/identity/USER.md)"
    Then the rendered message contains exactly 1 link
    And the rendered message links "agent_brain/identity/USER.md" labelled "mi perfil"

  Scenario: A path used as its own link label is not linked again
    When the assistant says "Mira [agent_brain/identity/USER.md](agent_brain/identity/USER.md)"
    Then the rendered message contains exactly 1 link
    And the rendered message has no nested links

  # --- A link the agent wrote gets the same label treatment (FR-CHAT-16) ---
  #
  # Observed in dev: asked for the path of a file, Buddy answers with a markdown
  # link whose label is a code span of the path. Autolinking never sees it — the
  # path is already inside a link — so without this the polished case is the one
  # that shows the most internal structure.

  Scenario: An agent-written link labelled with a brain path is shortened
    When the assistant says "Perfil: [`agent_brain/identity/USER.md`](agent_brain/identity/USER.md)"
    Then the rendered message links "agent_brain/identity/USER.md" labelled "USER.md"

  Scenario: An agent-written link labelled with a bare brain path is shortened
    When the assistant says "Perfil: [agent_brain/identity/USER.md](agent_brain/identity/USER.md)"
    Then the rendered message links "agent_brain/identity/USER.md" labelled "USER.md"

  Scenario: An agent-written link into the user space keeps its full path
    When the assistant says "Inbox: [`user/inbox.md`](user/inbox.md)"
    Then the rendered message links "user/inbox.md" labelled "user/inbox.md"

  Scenario: A descriptive label the agent chose is left alone
    When the assistant says "Mira [mi perfil](agent_brain/identity/USER.md)"
    Then the rendered message links "agent_brain/identity/USER.md" labelled "mi perfil"

  # The label is markdown and must render as such — the renderer printed it raw,
  # so `[**negrita**](x)` showed its asterisks (FR-CHAT-04).
  Scenario: Formatting inside a link label renders
    When the assistant says "Mira [**mi perfil**](agent_brain/identity/USER.md)"
    Then the rendered message shows the text "<strong>mi perfil</strong>"

  Scenario: An external link renders its label formatting too
    When the assistant says "Mira [**el sitio**](https://example.com)"
    Then the rendered message shows the text "<strong>el sitio</strong>"

  Scenario: Raw HTML in a link label is escaped, not emitted
    When the assistant says "Mira [<img src=x onerror=alert(1)>](user/inbox.md)"
    Then the rendered message shows the text "&lt;img"
    And the rendered message shows no img element

  # --- Backticks around a path are how a model writes a reference ---
  #
  # Verified in dev: asked where a file lives, Buddy answers with
  # `agent_brain/identity/USER.md`. Exempting code spans would leave the most
  # common case in the product unlinked.

  Scenario: A code span holding only a brain path becomes a link
    When the assistant says "El fichero `agent_brain/identity/USER.md` es tuyo"
    Then the rendered message links "agent_brain/identity/USER.md" labelled "USER.md"

  Scenario: A code span holding only a user path becomes a link
    When the assistant says "Tu inbox es `user/inbox.md`"
    Then the rendered message links "user/inbox.md" labelled "user/inbox.md"

  Scenario: A code span holding a path among other text is left as written
    When the assistant says "Ejecuta `cat user/inbox.md` en la terminal"
    Then the rendered message contains exactly 0 links
    And the rendered message shows the text "user/inbox.md"

  Scenario: A code span holding something that is not a path is left alone
    When the assistant says "Usa `npm test` para comprobarlo"
    Then the rendered message contains exactly 0 links

  Scenario: A path inside a fenced code block is left as written
    When the assistant says a fenced code block containing "agent_brain/identity/USER.md"
    Then the rendered message contains exactly 0 links

  # --- Out of bounds stays plain text ---

  Scenario: A path outside the four user-facing directories is not linked
    When the assistant says "Revisa .buddy/consolidation-state.json"
    Then the rendered message contains exactly 0 links

  Scenario: A file type Buddy cannot render inline is not linked
    When the assistant says "Descargué downloads/guide.pdf"
    Then the rendered message contains exactly 0 links

  Scenario: A traversal escaping the buddy directory is not linked
    When the assistant says "Mira user/../../secret.md"
    Then the rendered message contains exactly 0 links

  Scenario: A file at the buddy root is not linked
    When the assistant says "Lee AGENTS.md para entenderlo"
    Then the rendered message contains exactly 0 links

  # --- Reading the surrounding prose correctly ---

  Scenario: Trailing punctuation is not swallowed into the path
    When the assistant says "Lo guardé en user/inbox.md."
    Then the rendered message links "user/inbox.md" labelled "user/inbox.md"
    And the rendered message shows the text "."

  Scenario: Several paths in one sentence each become their own link
    When the assistant says "Moví user/inbox.md y actualicé agent_brain/identity/USER.md"
    Then the rendered message contains exactly 2 links
    And the rendered message links "user/inbox.md" labelled "user/inbox.md"
    And the rendered message links "agent_brain/identity/USER.md" labelled "USER.md"

  # An external URL that happens to contain a directory name is not a local path.
  Scenario: An external URL is untouched
    When the assistant says "Está en https://example.com/user/inbox.md"
    Then the rendered message contains exactly 1 link
    And the rendered message links to the external URL "https://example.com/user/inbox.md"
