# Sweep D: Daily Run as its own format (5.11)

Built: `core/daily.ts`. A Daily Run now ignores the player's own pool, draft rule, token, loan, Vault item, difficulty and modifiers: it uses the Classic starter set with the Standard rule (the same three starters for everyone, from the date seed), one daily modifier picked from the date (never a route or party-size modifier), and a short route (campaign `daily-route`: one region, four gyms, then the champion; the mode sets it). The Run Prep screen lists today's modifier, set and route. The Fourth Gym reward (`daily:fourth-gym`) already pays once per claim key.
Limits: the final boss is whichever the date seed picks (not hand-picked); no archived retries of past dailies.
