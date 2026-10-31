// Shadow and Blissful world events (APPROVED.md §12-14). Every one is gated on the counters the shadow world keeps
// (core/shadowWorld/world.ts: shadow-activity, shadow-outbreak, sanctuary-sign, kindness, rescued, ...), so an
// ordinary run never meets them. Written as plain objects: they use the `blessing` and `awaken` effects and the
// `shadow` / `blissful` battle and join fields.

import type { Json } from './dsl.ts';

export const SHADOW_WORLD_EVENTS: Json[] = [
  {
    "id": "shadow-outbreak",
    "name": "Shadow Outbreak",
    "group": "Shadow Pokémon",
    "stop": "haunted",
    "rarity": "uncommon",
    "minStage": 2,
    "requires": [
      {
        "kind": "flag",
        "key": "shadow-outbreak",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#1a0c2a",
      "effect": "fog"
    },
    "intro": "Purple haze hangs over the route. Wild Pokémon pace in circles, eyes dull. Something nearby is feeding it.",
    "choices": [
      {
        "label": "Search for the source",
        "success": {
          "text": "You find a humming canister and the Pokémon it has hazed!",
          "effects": [],
          "battle": {
            "kind": "wild",
            "species": [],
            "types": [
              "dark",
              "ghost",
              "poison"
            ],
            "levelBonus": 2,
            "shinyMultiplier": 1,
            "shadow": true,
            "blissful": false,
            "win": [
              {
                "kind": "flag",
                "key": "shadow-outbreak",
                "amount": -1
              },
              {
                "kind": "flag",
                "key": "kindness",
                "amount": 1
              },
              {
                "kind": "research",
                "amount": 15
              }
            ]
          }
        },
        "check": "intelligence",
        "failure": {
          "text": "The haze thickens and the Pokémon lash out. You retreat with scrapes.",
          "effects": [
            {
              "kind": "damage",
              "share": 0.1
            }
          ]
        }
      },
      {
        "label": "Let the Blissful aura settle the haze",
        "success": {
          "text": "Soft light spreads from your Blissful Pokémon. The haze thins and the route breathes again.",
          "effects": [
            {
              "kind": "flag",
              "key": "shadow-outbreak",
              "amount": -1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "heal",
              "share": 0.3
            }
          ]
        },
        "requires": [
          {
            "kind": "partyBlissful"
          }
        ]
      },
      {
        "label": "Avoid the area",
        "success": {
          "text": "You take the long way round. The haze stays where it is.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "shadow-stronghold",
    "name": "Hideout Infiltration",
    "group": "Shadow Pokémon",
    "stop": "hideout",
    "rarity": "uncommon",
    "minStage": 2,
    "requires": [
      {
        "kind": "flag",
        "key": "shadow-activity",
        "atLeast": 2
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#150c22",
      "effect": "flicker"
    },
    "intro": "A faction hideout is wedged into the cliffside: vents, a guarded loading dock and cages stacked behind glass. You can get a look at the guards before you choose.",
    "choices": [
      {
        "label": "Slip in through the vents",
        "success": {
          "text": "Quiet and quick. You open a cage and a hazed Pokémon steps out, trembling.",
          "effects": [
            {
              "kind": "join",
              "shadow": true,
              "species": [],
              "types": [
                "dark",
                "ghost",
                "poison"
              ],
              "levelBonus": -1,
              "shinyMultiplier": 1
            },
            {
              "kind": "flag",
              "key": "shadow-activity",
              "amount": -1
            }
          ]
        },
        "check": "speed",
        "failure": {
          "text": "A guard spots you. \"Intruder!\"",
          "effects": [],
          "battle": {
            "kind": "trainer",
            "name": "Hideout guards",
            "size": 3,
            "shadow": 1,
            "types": [
              "dark"
            ],
            "levelBonus": 1,
            "win": [
              {
                "kind": "money",
                "amount": 700
              },
              {
                "kind": "flag",
                "key": "shadow-activity",
                "amount": -1
              }
            ]
          }
        }
      },
      {
        "label": "Break in through the front",
        "success": {
          "text": "Alarms scream. The whole shift storms out to meet you!",
          "effects": [],
          "battle": {
            "kind": "trainer",
            "name": "Hideout guards",
            "size": 4,
            "shadow": 2,
            "types": [
              "dark"
            ],
            "levelBonus": 2,
            "win": [
              {
                "kind": "money",
                "amount": 1100
              },
              {
                "kind": "item",
                "id": "hyper-potion",
                "count": 1
              },
              {
                "kind": "flag",
                "key": "shadow-activity",
                "amount": -1
              },
              {
                "kind": "flag",
                "key": "kindness",
                "amount": 1
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "noTrainerTag",
            "tag": "pacifist"
          }
        ]
      },
      {
        "label": "Study the guards' patrol, then leave",
        "success": {
          "text": "You learn when they change shifts and which crates move at night.",
          "effects": [
            {
              "kind": "revealStops"
            },
            {
              "kind": "research",
              "amount": 10
            }
          ]
        }
      }
    ]
  },
  {
    "id": "shadow-black-market",
    "name": "Shadow Market",
    "group": "Shadow Pokémon",
    "stop": "merchant",
    "rarity": "rare",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "shadow-activity",
        "atLeast": 2
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#10101c",
      "effect": "fog"
    },
    "intro": "A hooded dealer sells from a crate behind a barn. \"Information, gear, special supplies. Nothing legal, nothing cheap.\"",
    "choices": [
      {
        "label": "Buy a tip about the factions (₽600)",
        "success": {
          "text": "He slides a folded map across. Circled in red: what the hideouts are moving.",
          "effects": [
            {
              "kind": "money",
              "amount": -600
            },
            {
              "kind": "revealStops"
            }
          ]
        },
        "requires": [
          {
            "kind": "money",
            "atLeast": 600
          }
        ]
      },
      {
        "label": "Ask about a Snag Ball (₽5000)",
        "success": {
          "text": "A battered ball with a black seam. He swears it works.",
          "effects": [
            {
              "kind": "money",
              "amount": -5000
            },
            {
              "kind": "item",
              "id": "snag-ball",
              "count": 1
            }
          ]
        },
        "requires": [
          {
            "kind": "money",
            "atLeast": 5000
          },
          {
            "kind": "flag",
            "key": "snag-ball-sold",
            "atLeast": 0,
            "atMost": 0
          }
        ],
        "chance": 0.4,
        "failure": {
          "text": "\"Sold out,\" he says, but keeps the money. The crate is empty.",
          "effects": [
            {
              "kind": "money",
              "amount": -5000
            }
          ]
        }
      },
      {
        "label": "Report the dealer to the Sanctuary Keepers",
        "success": {
          "text": "A keeper thanks you and pays for the tip. Another stall closes.",
          "effects": [
            {
              "kind": "money",
              "amount": 300
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "shadow-activity",
              "amount": -1
            }
          ]
        }
      },
      {
        "label": "Walk away",
        "success": {
          "text": "You leave the crate where it is.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "shadow-lieutenant",
    "name": "The Lieutenant Returns",
    "group": "Shadow Pokémon",
    "stop": "ambush",
    "rarity": "rare",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "lieutenant-loose",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#180c1c",
      "effect": "fog"
    },
    "intro": "A figure steps out of the trees, an escaped lieutenant with a fresh team. \"You cost me an operation. I want it back.\"",
    "choices": [
      {
        "label": "Fight them",
        "success": {
          "text": "They send out their best!",
          "effects": [],
          "battle": {
            "kind": "trainer",
            "name": "The Lieutenant's squad",
            "size": 4,
            "shadow": 1,
            "types": [
              "dark"
            ],
            "levelBonus": 2,
            "win": [
              {
                "kind": "money",
                "amount": 1500
              },
              {
                "kind": "flag",
                "key": "shadow-activity",
                "amount": -1
              },
              {
                "kind": "flag",
                "key": "lieutenant-loose",
                "amount": -1
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "noTrainerTag",
            "tag": "pacifist"
          }
        ]
      },
      {
        "label": "Bluff your way past",
        "success": {
          "text": "They hesitate long enough for you to slip away.",
          "effects": [
            {
              "kind": "friendship",
              "amount": -1,
              "who": "party"
            }
          ]
        },
        "check": "charisma",
        "failure": {
          "text": "They see through it and the squad shoves you to the ground.",
          "effects": [
            {
              "kind": "damage",
              "share": 0.12
            }
          ]
        }
      },
      {
        "label": "Turn back",
        "success": {
          "text": "You take another road. They will remember.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "sanctuary-found",
    "name": "The Hidden Sanctuary",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "rare",
    "minStage": 2,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-sign",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "sanctuary-found",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#10281e",
      "effect": "sparkle"
    },
    "intro": "Past the last bend the trees open on a quiet glade. Flowers bloom out of season. An old keeper bows. \"We hoped the kind would find us.\"",
    "choices": [
      {
        "label": "Rest in the glade",
        "success": {
          "text": "The air itself is gentle. You feel steadied.",
          "effects": [
            {
              "kind": "heal",
              "share": 1
            },
            {
              "kind": "cure"
            },
            {
              "kind": "flag",
              "key": "sanctuary-found",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "sanctuary-sign",
              "amount": -1
            },
            {
              "kind": "blessing",
              "id": "blessing-hearth"
            }
          ]
        }
      },
      {
        "label": "Hear the keeper's story",
        "success": {
          "text": "The keeper tells of a gentle light that visits those who protect others. You may meet it, if you stay kind.",
          "effects": [
            {
              "kind": "flag",
              "key": "sanctuary-found",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "sanctuary-sign",
              "amount": -1
            },
            {
              "kind": "research",
              "amount": 15
            },
            {
              "kind": "friendship",
              "amount": 3,
              "who": "party"
            }
          ]
        }
      },
      {
        "label": "Leave an offering (₽200)",
        "success": {
          "text": "The keeper accepts quietly, and a flower unfolds where you set the coins.",
          "effects": [
            {
              "kind": "money",
              "amount": -200
            },
            {
              "kind": "flag",
              "key": "sanctuary-found",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "sanctuary-sign",
              "amount": -1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-bloom"
            }
          ]
        },
        "requires": [
          {
            "kind": "money",
            "atLeast": 200
          }
        ]
      }
    ]
  },
  {
    "id": "blessing-trial",
    "name": "A Blessing Trial",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "uncommon",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-found",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "blessing-trial-done",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#16301f",
      "effect": "sparkle"
    },
    "intro": "A mossy arch hums. A keeper explains that no one needs to fight here. The trial asks only what kind of presence you are.",
    "choices": [
      {
        "label": "Coax the withered grove to bloom",
        "success": {
          "text": "Green climbs the arch. The grove leans toward you.",
          "effects": [
            {
              "kind": "flag",
              "key": "blessing-trial-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-bloom"
            }
          ]
        },
        "requires": [
          {
            "kind": "partyType",
            "type": "grass"
          }
        ]
      },
      {
        "label": "Calm the spirit that circles the arch",
        "success": {
          "text": "It settles on a Pokémon's shoulder. The arch lights.",
          "effects": [
            {
              "kind": "flag",
              "key": "blessing-trial-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-clarity"
            }
          ]
        },
        "requires": [
          {
            "kind": "partyType",
            "type": "psychic"
          }
        ]
      },
      {
        "label": "Hold the wind at the gate",
        "success": {
          "text": "You and your team keep the gate open until the wind gives up.",
          "effects": [
            {
              "kind": "flag",
              "key": "blessing-trial-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-hearth"
            }
          ]
        },
        "requires": [
          {
            "kind": "partyType",
            "type": "fighting"
          }
        ]
      },
      {
        "label": "Offer what you can spare (₽300)",
        "success": {
          "text": "The keeper nods. \"The attempt is the trial.\"",
          "effects": [
            {
              "kind": "money",
              "amount": -300
            },
            {
              "kind": "flag",
              "key": "blessing-trial-done",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-wild-grace"
            }
          ]
        },
        "requires": [
          {
            "kind": "money",
            "atLeast": 300
          }
        ]
      }
    ]
  },
  {
    "id": "sanctuary-guardian",
    "name": "The Guardian's Test",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "epic",
    "minStage": 4,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-found",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 3
      },
      {
        "kind": "flag",
        "key": "guardian-gift",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#1a3a2a",
      "effect": "sparkle"
    },
    "intro": "A huge Pokémon rises from the glade's pool and studies you. It has watched every kind thing you have done.",
    "choices": [
      {
        "label": "Promise to protect the sanctuary",
        "success": {
          "text": "It lowers its head. Something small and warm is left on the grass.",
          "effects": [
            {
              "kind": "flag",
              "key": "guardian-gift",
              "amount": 1
            },
            {
              "kind": "item",
              "id": "blessing-ball",
              "count": 1
            },
            {
              "kind": "egg",
              "species": [],
              "types": [
                "fairy",
                "grass",
                "psychic"
              ],
              "levelBonus": 0,
              "shinyMultiplier": 1,
              "left": 3,
              "unit": "stage"
            }
          ]
        },
        "requires": [
          {
            "kind": "flag",
            "key": "kindness",
            "atLeast": 3
          }
        ]
      },
      {
        "label": "Test your strength against it",
        "success": {
          "text": "It accepts, with a calm that unsettles you.",
          "effects": [],
          "battle": {
            "kind": "wild",
            "species": [],
            "types": [
              "water",
              "grass",
              "psychic"
            ],
            "levelBonus": 4,
            "shinyMultiplier": 1,
            "shadow": false,
            "blissful": false,
            "win": [
              {
                "kind": "research",
                "amount": 30
              },
              {
                "kind": "flag",
                "key": "guardian-gift",
                "amount": 1
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "noTrainerTag",
            "tag": "pacifist"
          }
        ]
      },
      {
        "label": "Bow and leave",
        "success": {
          "text": "It watches you go, unoffended.",
          "effects": [
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            }
          ]
        }
      }
    ]
  },
  {
    "id": "blissful-encounter",
    "name": "A Gentle Light",
    "group": "Blissful Pokémon",
    "stop": "wild",
    "rarity": "epic",
    "minStage": 3,
    "requires": [
      {
        "kind": "item",
        "id": "blessing-ball"
      },
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 3
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#223a30",
      "effect": "sparkle"
    },
    "intro": "Motes drift down the path. A Pokémon wrapped in soft light watches you from a patch of clover. It is not afraid of you, yet.",
    "choices": [
      {
        "label": "Approach with the Blessing Ball ready",
        "success": {
          "text": "It lets you come close. It does not attack. Offer the ball when you are ready.",
          "effects": [],
          "battle": {
            "kind": "wild",
            "species": [],
            "types": [
              "fairy",
              "psychic",
              "grass",
              "normal"
            ],
            "levelBonus": 1,
            "shinyMultiplier": 1,
            "shadow": false,
            "blissful": true,
            "win": [
              {
                "kind": "attribute",
                "key": "goodEvil",
                "amount": -2
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "item",
            "id": "blessing-ball"
          }
        ]
      },
      {
        "label": "Leave it in peace",
        "success": {
          "text": "The light follows you a little way, then turns back.",
          "effects": [
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            }
          ]
        }
      }
    ]
  },
  {
    "id": "sanctuary-attack",
    "name": "Sanctuary Under Attack",
    "group": "Blissful Pokémon",
    "stop": "ambush",
    "rarity": "rare",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-found",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "shadow-activity",
        "atLeast": 3
      },
      {
        "kind": "flag",
        "key": "sanctuary-restored",
        "atLeast": 0,
        "atMost": 0
      },
      {
        "kind": "flag",
        "key": "sanctuary-lost",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#2a1020",
      "effect": "flicker"
    },
    "intro": "Smoke over the glade. Faction raiders are hauling crates toward the pool where the Blissful light gathers.",
    "choices": [
      {
        "label": "Defend the sanctuary",
        "success": {
          "text": "The raiders turn on you!",
          "effects": [],
          "battle": {
            "kind": "trainer",
            "name": "Sanctuary raiders",
            "size": 4,
            "shadow": 1,
            "types": [
              "dark"
            ],
            "levelBonus": 2,
            "win": [
              {
                "kind": "flag",
                "key": "sanctuary-restored",
                "amount": 1
              },
              {
                "kind": "flag",
                "key": "shadow-activity",
                "amount": -2
              },
              {
                "kind": "flag",
                "key": "kindness",
                "amount": 2
              },
              {
                "kind": "blessing",
                "id": "blessing-hearth"
              },
              {
                "kind": "addStop",
                "stop": "heal"
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "noTrainerTag",
            "tag": "pacifist"
          }
        ]
      },
      {
        "label": "Lure them away from the pool",
        "success": {
          "text": "You lead the raiders in circles until the keepers drive them off.",
          "effects": [
            {
              "kind": "flag",
              "key": "sanctuary-restored",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            }
          ]
        },
        "check": "intelligence",
        "failure": {
          "text": "They catch you and take what they came for.",
          "effects": [
            {
              "kind": "flag",
              "key": "sanctuary-lost",
              "amount": 1
            },
            {
              "kind": "damage",
              "share": 0.1
            }
          ]
        }
      },
      {
        "label": "Run for help",
        "success": {
          "text": "By the time you return, the raiders are gone and so is some of the glade's light.",
          "effects": [
            {
              "kind": "flag",
              "key": "sanctuary-lost",
              "amount": 1
            }
          ]
        }
      }
    ]
  },
  {
    "id": "ancient-shrine",
    "name": "Ancient Shrine",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "uncommon",
    "minStage": 2,
    "requires": [
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#2a2620",
      "effect": "glint"
    },
    "intro": "A weathered shrine, its stones warm in the shade. A bowl waits for an offering.",
    "choices": [
      {
        "label": "Leave an offering (₽150)",
        "success": {
          "text": "The bowl glows. A light settles over the party.",
          "effects": [
            {
              "kind": "money",
              "amount": -150
            },
            {
              "kind": "blessing",
              "id": "blessing-wild-grace"
            }
          ]
        },
        "requires": [
          {
            "kind": "money",
            "atLeast": 150
          }
        ]
      },
      {
        "label": "Sit and listen",
        "success": {
          "text": "Quiet for a few breaths. A clear head, nothing more.",
          "effects": [
            {
              "kind": "blessing",
              "id": "blessing-clarity"
            }
          ]
        }
      },
      {
        "label": "Move on",
        "success": {
          "text": "The shrine will wait.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "hurt-wanderer",
    "name": "A Hurt Wanderer",
    "group": "Blissful Pokémon",
    "stop": "wild",
    "rarity": "uncommon",
    "minStage": 2,
    "requires": [
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "escort",
        "atLeast": 0,
        "atMost": 0
      },
      {
        "kind": "flag",
        "key": "escort-done",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#1c2c28",
      "effect": "float"
    },
    "intro": "A gentle Pokémon limps beside the road, favouring one leg. It looks toward a distant ridge, then at you.",
    "choices": [
      {
        "label": "Carry it toward the ridge",
        "success": {
          "text": "It leans against you. The road ahead will be long.",
          "effects": [
            {
              "kind": "flag",
              "key": "escort",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            }
          ]
        }
      },
      {
        "label": "Leave it some food and go",
        "success": {
          "text": "It sniffs the food. It does not follow.",
          "effects": [
            {
              "kind": "friendship",
              "amount": 1,
              "who": "party"
            }
          ]
        }
      }
    ]
  },
  {
    "id": "wanderer-arrives",
    "name": "The Wanderer Arrives",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "uncommon",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "escort",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#1a3a2a",
      "effect": "sparkle"
    },
    "intro": "The ridge road ends at a quiet sanctuary. The Pokémon you carried is steady on its feet now, and a keeper hurries out.",
    "choices": [
      {
        "label": "Stay until it is settled",
        "success": {
          "text": "It touches its nose to your hand. The keeper gives you something warm to carry.",
          "effects": [
            {
              "kind": "flag",
              "key": "escort",
              "amount": -1
            },
            {
              "kind": "flag",
              "key": "escort-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 2
            },
            {
              "kind": "flag",
              "key": "sanctuary-sign",
              "amount": 1
            },
            {
              "kind": "join",
              "species": [],
              "types": [
                "fairy",
                "normal",
                "psychic"
              ],
              "levelBonus": -1,
              "shinyMultiplier": 1,
              "blissful": true
            }
          ]
        }
      },
      {
        "label": "Hand it over and go",
        "success": {
          "text": "The keeper thanks you. It watches you out of sight.",
          "effects": [
            {
              "kind": "flag",
              "key": "escort",
              "amount": -1
            },
            {
              "kind": "flag",
              "key": "escort-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "sanctuary-sign",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-bloom"
            }
          ]
        }
      }
    ]
  },
  {
    "id": "blissful-awakening",
    "name": "A Blissful Awakening",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "epic",
    "minStage": 5,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-restored",
        "atLeast": 1
      },
      {
        "kind": "friendship",
        "atLeast": 150
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#2a4030",
      "effect": "sparkle"
    },
    "intro": "The restored sanctuary glows. A light gathers around the Pokémon who has stood with you longest.",
    "choices": [
      {
        "label": "Let it come",
        "success": {
          "text": "The light settles. It looks the same, and not at all the same.",
          "effects": [
            {
              "kind": "awaken"
            }
          ]
        }
      },
      {
        "label": "Step between it and the light",
        "success": {
          "text": "The light fades. Perhaps another day.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "rescued-callback",
    "name": "A Familiar Face",
    "group": "Shadow Pokémon",
    "stop": "wild",
    "rarity": "uncommon",
    "minStage": 4,
    "requires": [
      {
        "kind": "flag",
        "key": "rescued",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#1c2030",
      "effect": "float"
    },
    "intro": "A Pokémon you helped free earlier steps onto the road with a keeper in tow. It remembers you.",
    "choices": [
      {
        "label": "Accept its thanks",
        "success": {
          "text": "It pushes a small bundle toward you.",
          "effects": [
            {
              "kind": "item",
              "id": "hyper-potion",
              "count": 1
            },
            {
              "kind": "friendship",
              "amount": 2,
              "who": "party"
            },
            {
              "kind": "flag",
              "key": "rescued",
              "amount": -1
            }
          ]
        }
      },
      {
        "label": "Ask what it saw",
        "success": {
          "text": "It draws a trail in the dust: a hideout, a shipment, a shortcut.",
          "effects": [
            {
              "kind": "revealStops"
            },
            {
              "kind": "flag",
              "key": "rescued",
              "amount": -1
            }
          ]
        }
      }
    ]
  },
  {
    "id": "two-visitors",
    "name": "Two Visitors",
    "group": "Shadow Pokémon",
    "stop": "merchant",
    "rarity": "uncommon",
    "minStage": 3,
    "requires": [
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "shadow-activity",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#20202c",
      "effect": "fog"
    },
    "intro": "A sanctuary keeper and a collector in a good coat have set up on the same crate. They have opinions about your team.",
    "choices": [
      {
        "label": "Side with the keeper",
        "success": {
          "text": "The keeper nods. The collector scowls.",
          "effects": [
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "blessing",
              "id": "blessing-clarity"
            }
          ]
        }
      },
      {
        "label": "Hear the collector out",
        "success": {
          "text": "\"Strength is strength,\" he says, and sells you a lead.",
          "effects": [
            {
              "kind": "revealStops"
            },
            {
              "kind": "attribute",
              "key": "goodEvil",
              "amount": -1
            }
          ]
        }
      },
      {
        "label": "Politely refuse both",
        "success": {
          "text": "You leave them to argue.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "rival-views",
    "name": "The Rival's Opinion",
    "group": "Shadow Pokémon",
    "stop": "event",
    "rarity": "uncommon",
    "minStage": 4,
    "requires": [
      {
        "kind": "rivalMet",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "rescued",
        "atLeast": 1
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#20202c",
      "effect": "none"
    },
    "intro": "Your rival leans on a fence. \"You took a Shadow Pokémon off its trainer? Heroic, or just greedy?\"",
    "choices": [
      {
        "label": "\"Someone had to.\"",
        "success": {
          "text": "They think about it. \"I'd have done it faster.\"",
          "effects": [
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            },
            {
              "kind": "attribute",
              "key": "charisma",
              "amount": 1
            }
          ]
        }
      },
      {
        "label": "\"It's a strong Pokémon.\"",
        "success": {
          "text": "\"That's what I thought you'd say.\"",
          "effects": [
            {
              "kind": "attribute",
              "key": "goodEvil",
              "amount": -1
            }
          ]
        }
      },
      {
        "label": "Say nothing",
        "success": {
          "text": "They shrug and walk on.",
          "effects": []
        }
      }
    ]
  },
  {
    "id": "legendary-blessing",
    "name": "The Legendary Blessing",
    "group": "Blissful Pokémon",
    "stop": "shrine",
    "rarity": "epic",
    "minStage": 5,
    "requires": [
      {
        "kind": "flag",
        "key": "sanctuary-restored",
        "atLeast": 1
      },
      {
        "kind": "flag",
        "key": "kindness",
        "atLeast": 6
      },
      {
        "kind": "flag",
        "key": "legendary-blessing-done",
        "atLeast": 0,
        "atMost": 0
      }
    ],
    "scene": {
      "cast": [],
      "tint": "#2a4a3a",
      "effect": "sparkle"
    },
    "intro": "The restored glade is silent. Then the light changes, and something very old is standing at the edge of the pool.",
    "choices": [
      {
        "label": "Stand still and let it look at you",
        "success": {
          "text": "It comes close. It is not a fight. Hold out the Blessing Ball when it lets you.",
          "effects": [
            {
              "kind": "flag",
              "key": "legendary-blessing-done",
              "amount": 1
            }
          ],
          "battle": {
            "kind": "wild",
            "species": [
              "mesprit",
              "shaymin",
              "celebi",
              "jirachi",
              "manaphy",
              "cresselia",
              "latias"
            ],
            "types": [],
            "levelBonus": 3,
            "shinyMultiplier": 1,
            "shadow": false,
            "blissful": true,
            "win": [
              {
                "kind": "attribute",
                "key": "goodEvil",
                "amount": -3
              }
            ]
          }
        },
        "requires": [
          {
            "kind": "item",
            "id": "blessing-ball"
          }
        ]
      },
      {
        "label": "Bow and step back",
        "success": {
          "text": "It lingers, then goes. The glade will remember.",
          "effects": [
            {
              "kind": "flag",
              "key": "legendary-blessing-done",
              "amount": 1
            },
            {
              "kind": "flag",
              "key": "kindness",
              "amount": 1
            }
          ]
        }
      }
    ]
  }
];
