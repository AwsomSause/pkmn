# Master Idea Library 11: Visual, Audio & Presentation (VA-001 to VA-080)

Legend and fields as in file 01. Design only. Style direction: flowy, bouncy, animated; Frutiger Aero, DS-era, Wii-era and Cyber-Maximalism (see the project style guide). Every effect must respect motion, intensity, skip and audio settings, and must never change battle outcomes.

## A. Screens and UI motion

**VA-001 Bubble UI Language** — Menus built from glossy bubble panels that squash and bounce when opened, like Aero glass droplets. *Trigger:* any menu. *Feel:* cohesive tactile identity. *Rarity:* Always. *Cx:* M. *Deps:* UI kit. *Balance:* none.


**VA-003 Springy Cursor** — Menu cursor overshoots and settles with squash and stretch. *Trigger:* nav. *Feel:* juicy. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**VA-004 Page-Turn Pokédex** — Dex pages curl and turn with paper sound. *Trigger:* dex. *Feel:* tactile. *Rarity:* Always. *Cx:* M. *Deps:* dex UI. *Balance:* none.

**VA-005 Glass Dock** — Bottom dock with magnifying icons. *Trigger:* menu. *Feel:* Aero-era. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**VA-006 Cyber Grid Transitions** — Wipes via neon grid sweeps between scenes. *Trigger:* transitions. *Feel:* Cyber-Maximalist. *Rarity:* Always. *Cx:* M. *Deps:* transitions. *Balance:* photosensitivity-safe.

**VA-007 Animated HP Bars With Personality** — Bars slosh like liquid, with nature-based jiggle. *Trigger:* damage. *Feel:* alive. *Rarity:* Always. *Cx:* M. *Deps:* HP bars. *Balance:* none.

**VA-008 Parallax Hub** — Hub scrolls with deep parallax and time-of-day lighting. *Trigger:* Hub. *Feel:* cozy. *Rarity:* Always. *Cx:* M. *Deps:* Hub art. *Balance:* none.

**VA-009 Dynamic Backgrounds Per Mood** — Menu backgrounds tint by team mood and recent events. *Trigger:* menu. *Feel:* reactive. *Rarity:* Always. *Cx:* M. *Deps:* mood. *Balance:* none.

**VA-010 Type-Coloured Ripples** — Interacting with type chips spawns ripples in type colours. *Trigger:* tap. *Feel:* playful. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

## B. Battle visuals

**VA-011 Move Trails Per Type** — Each type leaves distinct trails (water ribbon, ghost wisps). *Trigger:* move. *Feel:* readable style. *Rarity:* Always. *Cx:* M. *Deps:* animation registry. *Balance:* none.

**VA-012 Impact Frames** — Single-frame ink flashes on crits, anime style. *Trigger:* crit. *Feel:* punch. *Rarity:* Common. *Cx:* S. *Deps:* animations. *Balance:* safe flash cap.

**VA-013 Ability Cut-Ins** — Ability activation shows a character cut-in banner with the Pokémon portrait. *Trigger:* ability. *Feel:* dramatic. *Rarity:* Common. *Cx:* M. *Deps:* anim abilities. *Balance:* skippable.


**VA-015 Shadow Casting** — Pokémon cast dynamic shadows from the sun. *Trigger:* battle. *Feel:* grounded. *Rarity:* Always. *Cx:* M. *Deps:* renderer. *Balance:* none.

**VA-016 Faint Dissolves** — Fainting sprites dissolve into type-coloured motes. *Trigger:* faint. *Feel:* gentle. *Rarity:* Always. *Cx:* S. *Deps:* animations. *Balance:* none.

**VA-017 Evolution Cinematics Per Family** — Each family has bespoke evolution sequences. *Trigger:* evolve. *Feel:* payoff. *Rarity:* Always. *Cx:* L. *Deps:* evolution. *Balance:* none.

**VA-018 Boss Entrance Sequences** — Bosses get unique intro cinematics with camera work. *Trigger:* boss. *Feel:* epic. *Rarity:* Boss. *Cx:* L. *Deps:* bosses. *Balance:* skippable.

**VA-019 Ring-Out Silhouettes** — On win a silhouette pose with title card for each Pokémon. *Trigger:* win. *Feel:* showy. *Rarity:* Common. *Cx:* S. *Deps:* animations. *Balance:* none.

**VA-020 Terrain Shimmer** — Terrain fields shimmer with type colours. *Trigger:* terrain. *Feel:* clarity. *Rarity:* Common. *Cx:* S. *Deps:* terrain. *Balance:* none.

## C. Map and world visuals

**VA-021 Hand-Painted Route Illustrations** — Route nodes unfold as illustrated vignettes. *Trigger:* map. *Feel:* storybook. *Rarity:* Always. *Cx:* L. *Deps:* assets. *Balance:* none.

**VA-022 Day-Night Colour Grading** — Smooth day-night LUT transitions. *Trigger:* time. *Feel:* immersive. *Rarity:* Always. *Cx:* M. *Deps:* shaders. *Balance:* none.

**VA-023 Footprints And Trails** — Party leaves visible trails on the map that fade. *Trigger:* walking. *Feel:* tactile. *Rarity:* Always. *Cx:* S. *Deps:* map. *Balance:* none.

**VA-024 Animated Map Creatures** — Background creatures roam on map backdrops. *Trigger:* map. *Feel:* life. *Rarity:* Always. *Cx:* M. *Deps:* map art. *Balance:* none.

**VA-025 Seasonal Skins** — Whole-UI seasonal skins (snow, cherry blossoms). *Trigger:* date. *Feel:* festive. *Rarity:* Seasonal. *Cx:* M. *Deps:* holiday events. *Balance:* none.

**VA-026 Aurora And Starfields** — Night skies with aurora and constellations tied to events. *Trigger:* night. *Feel:* awe. *Rarity:* Common. *Cx:* M. *Deps:* time. *Balance:* none.

**VA-027 Water Reflections** — Water nodes reflect sprites. *Trigger:* water. *Feel:* polish. *Rarity:* Common. *Cx:* M. *Deps:* shaders. *Balance:* low-end mode.

**VA-028 Fog And Mist Layers** — Layered mist adds depth. *Trigger:* swamp. *Feel:* mood. *Rarity:* Common. *Cx:* S. *Deps:* shaders. *Balance:* none.

**VA-029 Stained-Glass Ruins** — Light through stained glass paints the ground. *Trigger:* ruin. *Feel:* beautiful. *Rarity:* Rare. *Cx:* M. *Deps:* shaders. *Balance:* none.

**VA-030 Tilt-Shift Town Views** — Miniature-effect town overviews. *Trigger:* town. *Feel:* charming. *Rarity:* Common. *Cx:* M. *Deps:* shaders. *Balance:* none.

## D. Audio and music

**VA-031 Adaptive Leitmotifs** — Each rival and legend has a leitmotif that surfaces in map music. *Trigger:* proximity. *Feel:* narrative sound. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**VA-032 Region Instrumentation** — Each region's music uses distinct instruments. *Trigger:* region. *Feel:* identity. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**VA-033 Cry-Based Percussion** — Battle music incorporates cries rhythmically for the lead. *Trigger:* battle. *Feel:* unique. *Rarity:* Rare. *Cx:* L. *Deps:* audio. *Balance:* none.

**VA-034 Silence As A Tool** — Strategic silence before big moments. *Trigger:* boss. *Feel:* tension. *Rarity:* Boss. *Cx:* S. *Deps:* audio. *Balance:* none.

**VA-035 Foley Library** — Footstep, cloth and item foley per terrain. *Trigger:* walking. *Feel:* tactile. *Rarity:* Always. *Cx:* M. *Deps:* audio. *Balance:* none.

**VA-036 Stem-Based Remix Menu** — Jukebox allowing stem mixes and remixes unlocked by play. *Trigger:* Hub. *Feel:* fun. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**VA-037 Ambient Pokémon Choruses** — Dawn and dusk choruses by region species. *Trigger:* time. *Feel:* atmosphere. *Rarity:* Always. *Cx:* M. *Deps:* audio. *Balance:* none.

**VA-038 Bond-Linked Harmony** — Music adds harmony as the party's bond rises. *Trigger:* bond. *Feel:* emotional. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**VA-039 Low-HP Heartbeat Layer** — Optional heartbeat layer. *Trigger:* low HP. *Feel:* tension. *Rarity:* Setting. *Cx:* S. *Deps:* audio. *Balance:* toggle.


## E. Typography, text and speech

**VA-041 Expressive Text Effects** — Text shakes, whispers, waves according to speaker emotion. *Trigger:* dialogue. *Feel:* expressive. *Rarity:* Always. *Cx:* M. *Deps:* dialogue box. *Balance:* reduced-motion.

**VA-042 Per-Character Blip Voices** — Each speaker has a blip sound. *Trigger:* dialogue. *Feel:* identity. *Rarity:* Always. *Cx:* S. *Deps:* audio. *Balance:* mute option.

**VA-043 Pokémon Speech Bubbles** — Emotes and small icon bubbles instead of words. *Trigger:* idle. *Feel:* cute. *Rarity:* Always. *Cx:* M. *Deps:* dialogue. *Balance:* none.

**VA-044 Handwritten Letters** — Letters render in handwriting fonts per sender. *Trigger:* letters. *Feel:* personal. *Rarity:* Always. *Cx:* S. *Deps:* fonts. *Balance:* none.

**VA-045 Title Card Typography Per Act** — Act titles use distinct lettering. *Trigger:* act. *Feel:* cinematic. *Rarity:* Always. *Cx:* S. *Deps:* fonts. *Balance:* none.


**VA-047 Newspaper Layouts** — Newspaper UI for news events. *Trigger:* Hub. *Feel:* period. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**VA-048 Emote Library** — Rich emotes for Pokémon moods. *Trigger:* mood. *Feel:* readable. *Rarity:* Always. *Cx:* M. *Deps:* mood. *Balance:* none.

**VA-049 Stylish Damage Popups** — Popups with icons for crit, resist. *Trigger:* damage. *Feel:* readable. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**VA-050 Ransom Note Warnings** — Villains communicate via ransom note typography. *Trigger:* villain. *Feel:* fun. *Rarity:* Common. *Cx:* S. *Deps:* dialogue. *Balance:* none.

## F. Cutscenes and spectacle

**VA-051 Letterbox Cinematic Mode** — Big story beats use letterbox cinematic framing. *Trigger:* story. *Feel:* grand. *Rarity:* Common. *Cx:* M. *Deps:* camera. *Balance:* none.

**VA-052 Slow Motion Beat** — Dramatic slow motion at key KOs. *Trigger:* KO. *Feel:* punch. *Rarity:* Rare. *Cx:* S. *Deps:* animations. *Balance:* skip.


**VA-054 Comic Panel Flashbacks** — Flashbacks rendered as comic panels. *Trigger:* story. *Feel:* stylish. *Rarity:* Common. *Cx:* M. *Deps:* assets. *Balance:* skip.

**VA-055 Shadow Puppet Lore Scenes** — Lore told with shadow puppets. *Trigger:* lore. *Feel:* artful. *Rarity:* Rare. *Cx:* M. *Deps:* assets. *Balance:* skip.

**VA-056 Montage Generator** — Auto montages for training and travel. *Trigger:* rest. *Feel:* anime. *Rarity:* Common. *Cx:* L. *Deps:* animation. *Balance:* skip.


**VA-058 Title Screen Remixes** — Title music/visual reflect progress. *Trigger:* launch. *Feel:* reward. *Rarity:* Always. *Cx:* M. *Deps:* title. *Balance:* none.


**VA-060 Fireworks For Milestones** — Fireworks at big milestones. *Trigger:* milestone. *Feel:* celebration. *Rarity:* Rare. *Cx:* S. *Deps:* particles. *Balance:* none.

## G. Pokémon art and animation

**VA-061 Idle Variations Per Individual** — Individuals have subtle idle variance. *Trigger:* idle. *Feel:* unique. *Rarity:* Always. *Cx:* M. *Deps:* sprites. *Balance:* none.

**VA-062 Expressions** — Faces change by mood where sprites allow. *Trigger:* mood. *Feel:* alive. *Rarity:* Always. *Cx:* L. *Deps:* sprites. *Balance:* none.

**VA-063 Overworld Followers** — Lead Pokémon follows the trainer on the map with physics. *Trigger:* map. *Feel:* charm. *Rarity:* Always. *Cx:* L. *Deps:* map. *Balance:* none.

**VA-064 Sprite Customisation** — Hue sliders and accessories for sprites. *Trigger:* Hub. *Feel:* personal. *Rarity:* Always. *Cx:* M. *Deps:* sprites. *Balance:* none.

**VA-065 Form Transition Morphs** — Smooth morphs between forms. *Trigger:* form. *Feel:* wow. *Rarity:* Common. *Cx:* L. *Deps:* forms. *Balance:* none.

**VA-066 3D-Look Sprite Lighting** — Normal-mapped lighting on 2D sprites. *Trigger:* battle. *Feel:* depth. *Rarity:* Always. *Cx:* L. *Deps:* renderer. *Balance:* low-end.

**VA-067 Size Comparison Mode** — Show relative sizes of Pokémon. *Trigger:* UI. *Feel:* fun. *Rarity:* Always. *Cx:* S. *Deps:* dex. *Balance:* none.

**VA-068 Pokémon Portraits In Dialogue** — Expressive portraits for speaking Pokémon. *Trigger:* dialogue. *Feel:* expressive. *Rarity:* Always. *Cx:* L. *Deps:* assets. *Balance:* none.


**VA-070 Scale-Aware Animations** — Large Pokémon animate slower and heavier. *Trigger:* battle. *Feel:* weight. *Rarity:* Always. *Cx:* M. *Deps:* animation. *Balance:* none.

## H. Branding and share-ables

**VA-071 Shareable Run Card** — Generated image of your run for sharing. *Trigger:* run end. *Feel:* social. *Rarity:* Always. *Cx:* M. *Deps:* recap. *Balance:* none.

**VA-072 Animated Logo Reactions** — Logo reacts to inputs on title. *Trigger:* title. *Feel:* playful. *Rarity:* Always. *Cx:* S. *Deps:* title. *Balance:* none.

**VA-073 Trailer Mode** — Auto-cut trailer from your run footage. *Trigger:* menu. *Feel:* showy. *Rarity:* Always. *Cx:* XL. *Deps:* replay. *Balance:* none.

**VA-074 Retro Ad Generator** — Make a 2000s-style ad of your team. *Trigger:* menu. *Feel:* funny. *Rarity:* Always. *Cx:* L. *Deps:* promo style. *Balance:* none.


**VA-076 Box Art Selector** — Choose alternate box art for your save. *Trigger:* Hub. *Feel:* collectible. *Rarity:* Always. *Cx:* S. *Deps:* promo. *Balance:* none.

**VA-077 Soundtrack Player** — Standalone soundtrack player. *Trigger:* menu. *Feel:* appreciated. *Rarity:* Always. *Cx:* S. *Deps:* audio. *Balance:* none.

**VA-078 Concept Art Gallery** — Unlockable gallery with notes. *Trigger:* unlock. *Feel:* reward. *Rarity:* Long-term. *Cx:* S. *Deps:* assets. *Balance:* none.


**VA-080 Credits Roll With Pokémon Parade** — Credits show your Pokémon dancing in procession. *Trigger:* credits. *Feel:* joy. *Rarity:* Always. *Cx:* M. *Deps:* credits. *Balance:* none.
