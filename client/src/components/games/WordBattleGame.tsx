import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Trophy, Bot, User, Check, X, Send, RotateCcw, Sparkles, Loader2, Lightbulb, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WordBattleGameProps {
  stake: number;
  onGameEnd: (won: boolean, score?: number) => void;
  isPractice: boolean;
}

interface WordValidationResult {
  valid: boolean;
  feedback?: string;
  funFact?: string | null;
  usedFallback?: boolean;
}

interface LetterGenerationResult {
  letters: string[];
  hint?: string | null;
  possibleWordCount?: number;
  usedFallback?: boolean;
}

const COMMON_WORDS = [
  "a", "i", "am", "an", "as", "at", "be", "by", "do", "go", "he", "if", "in", "is", "it", "me", "my", "no", "of", "on", "or", "so", "to", "up", "us", "we",
  "ace", "act", "add", "age", "ago", "aid", "aim", "air", "all", "and", "ant", "any", "ape", "arc", "are", "ark", "arm", "art", "ask", "ate", "awe", "axe",
  "bad", "bag", "ban", "bar", "bat", "bay", "bed", "bee", "bet", "bid", "big", "bin", "bit", "bow", "box", "boy", "bud", "bug", "bus", "but", "buy",
  "cab", "can", "cap", "car", "cat", "cop", "cow", "cry", "cub", "cup", "cut",
  "dad", "dam", "day", "den", "dew", "did", "die", "dig", "dim", "dip", "dog", "dot", "dry", "dub", "dud", "due", "dug", "dye",
  "ear", "eat", "eel", "egg", "ego", "elf", "elk", "elm", "end", "era", "eve", "ewe", "eye",
  "fab", "fad", "fan", "far", "fat", "fax", "fed", "fee", "few", "fig", "fin", "fir", "fit", "fix", "fly", "foe", "fog", "for", "fox", "fry", "fun", "fur",
  "gag", "gap", "gas", "gay", "gel", "gem", "get", "gig", "gin", "god", "got", "gum", "gun", "gut", "guy", "gym",
  "had", "ham", "has", "hat", "hay", "hem", "hen", "her", "hid", "him", "hip", "his", "hit", "hob", "hoe", "hog", "hop", "hot", "how", "hub", "hue", "hug", "hum", "hut",
  "ice", "icy", "ill", "imp", "ink", "inn", "ion", "ire", "irk", "its", "ivy",
  "jab", "jag", "jam", "jar", "jaw", "jay", "jet", "jig", "job", "jog", "jot", "joy", "jug", "jut",
  "keg", "ken", "key", "kid", "kin", "kit",
  "lab", "lad", "lag", "lap", "law", "lay", "lea", "led", "leg", "let", "lid", "lie", "lip", "lit", "log", "lot", "low", "lug",
  "mad", "man", "map", "mar", "mat", "maw", "may", "men", "met", "mid", "mix", "mob", "mop", "mow", "mud", "mug", "mum",
  "nab", "nag", "nap", "nay", "net", "new", "nil", "nip", "nit", "nod", "nor", "not", "now", "nun", "nut",
  "oak", "oar", "oat", "odd", "ode", "off", "oft", "oil", "old", "one", "opt", "orb", "ore", "our", "out", "owe", "owl", "own",
  "pad", "pal", "pan", "pap", "par", "pat", "paw", "pay", "pea", "peg", "pen", "pep", "per", "pet", "pew", "pie", "pig", "pin", "pit", "ply", "pod", "pop", "pot", "pow", "pro", "pry", "pub", "pun", "pup", "pus", "put",
  "rag", "ram", "ran", "rap", "rat", "raw", "ray", "red", "ref", "rep", "rib", "rid", "rig", "rim", "rip", "rob", "rod", "roe", "rot", "row", "rub", "rug", "rum", "run", "rut", "rye",
  "sac", "sad", "sag", "sap", "sat", "saw", "say", "sea", "set", "sew", "she", "shy", "sin", "sip", "sir", "sis", "sit", "six", "ski", "sky", "sly", "sob", "sod", "son", "sop", "sot", "sow", "soy", "spa", "spy", "sub", "sue", "sum", "sun", "sup",
  "tab", "tad", "tag", "tan", "tap", "tar", "tax", "tea", "ten", "the", "thy", "tic", "tie", "tin", "tip", "toe", "tog", "ton", "too", "top", "tot", "tow", "toy", "try", "tub", "tug", "tun", "two",
  "ugh", "ump", "urn", "use",
  "van", "vat", "vet", "via", "vie", "vim", "vow",
  "wad", "wag", "war", "was", "wax", "way", "web", "wed", "wee", "wet", "who", "why", "wig", "win", "wit", "woe", "wok", "won", "woo", "wow",
  "yak", "yam", "yap", "yaw", "yea", "yen", "yes", "yet", "yew", "yin", "yip", "you", "yow",
  "zag", "zap", "zed", "zee", "zen", "zig", "zip", "zit", "zoo",
  "able", "ache", "acre", "aged", "also", "area", "army", "away", "baby", "back", "ball", "band", "bank", "base", "bear", "beat", "been", "best", "bird", "blow", "blue", "boat", "body", "bold", "bone", "book", "bore", "born", "boss", "both", "bowl", "burn", "busy", "call", "calm", "came", "camp", "cape", "card", "care", "case", "cash", "cast", "cave", "chef", "city", "clam", "clan", "clap", "clay", "clip", "club", "clue", "coal", "coat", "code", "coin", "cold", "come", "cook", "cool", "cope", "copy", "core", "corn", "cost", "crew", "crop", "cure", "cute", "dale", "damn", "damp", "dare", "dark", "data", "date", "dawn", "days", "dead", "deal", "dean", "dear", "debt", "deck", "deed", "deep", "deer", "deny", "desk", "dial", "diet", "disc", "dish", "dive", "dock", "does", "doll", "dome", "done", "door", "dose", "down", "drag", "draw", "drew", "drip", "drop", "drug", "drum", "dual", "duck", "dude", "duel", "duke", "dull", "dumb", "dump", "dune", "dunk", "dupe", "dust", "duty", "dyed",
  "each", "earl", "earn", "ease", "east", "easy", "echo", "edge", "edit", "else", "emit", "ends", "epic", "euro", "even", "ever", "exam", "exec", "exit", "expo", "eyed", "eyes", "face", "fact", "fade", "fail", "fair", "fake", "fall", "fame", "fang", "fare", "farm", "fast", "fate", "fear", "feat", "feed", "feel", "feet", "fell", "felt", "fern", "fest", "file", "fill", "film", "find", "fine", "fire", "firm", "fish", "fist", "fits", "five", "flag", "flap", "flat", "flaw", "fled", "flee", "flew", "flip", "flit", "flow", "flux", "foam", "fold", "folk", "fond", "font", "food", "fool", "foot", "ford", "fore", "fork", "form", "fort", "foul", "four", "fowl", "fray", "free", "frog", "from", "fuel", "full", "fume", "fund", "funk", "fuse", "fuss", "gain", "gale", "game", "gang", "gaps", "garb", "gate", "gave", "gaze", "gear", "gene", "gift", "gilt", "girl", "give", "glad", "glen", "glue", "glum", "gnat", "gnaw", "goal", "goat", "goes", "gold", "golf", "gone", "good", "gore", "gown", "grab", "gram", "gray", "grew", "grey", "grid", "grim", "grin", "grip", "grit", "grow", "gulf", "gust", "guts", "hack", "hail", "hair", "half", "hall", "halt", "hand", "hang", "hard", "hare", "harm", "harp", "hash", "hate", "haul", "have", "hawk", "haze", "hazy", "head", "heal", "heap", "hear", "heat", "heel", "heir", "held", "hell", "helm", "help", "herb", "herd", "here", "hero", "hide", "high", "hike", "hill", "hint", "hire", "hold", "hole", "holy", "home", "hood", "hook", "hope", "horn", "host", "hour", "huge", "hull", "hung", "hunt", "hurt", "hush", "icon", "idea", "idle", "idol", "inch", "info", "into", "iron", "isle", "item", "jack", "jade", "jail", "jazz", "jean", "jerk", "jest", "jobs", "john", "join", "joke", "jolt", "jump", "june", "junk", "jury", "just", "keen", "keep", "kept", "kick", "kids", "kill", "kind", "king", "kiss", "kite", "knee", "knew", "knit", "knob", "knot", "know", "lace", "lack", "lady", "laid", "lake", "lamb", "lamp", "land", "lane", "laps", "lard", "last", "late", "lawn", "laws", "lazy", "lead", "leaf", "lean", "leap", "left", "lend", "lens", "less", "lick", "life", "lift", "like", "limb", "lime", "limp", "line", "link", "lion", "lips", "list", "live", "load", "loaf", "loan", "lock", "loft", "logo", "lone", "long", "look", "loop", "lord", "lore", "lose", "loss", "lost", "lots", "loud", "love", "luck", "lump", "lung", "lure", "lurk", "lush", "lust", "made", "maid", "mail", "main", "make", "male", "mall", "malt", "many", "mare", "mark", "mars", "mash", "mask", "mass", "mast", "mate", "math", "maul", "maze", "meal", "mean", "meat", "meek", "meet", "melt", "memo", "mend", "menu", "mere", "mesh", "mess", "mice", "mild", "mile", "milk", "mill", "mime", "mind", "mine", "mint", "miss", "mist", "moan", "moat", "mock", "mode", "mold", "mole", "monk", "mood", "moon", "more", "morn", "moss", "most", "moth", "move", "much", "muck", "mule", "muse", "mush", "musk", "must", "mute", "myth", "nail", "name", "nape", "navy", "near", "neat", "neck", "need", "nest", "news", "next", "nice", "nick", "nine", "node", "none", "noon", "norm", "nose", "note", "noun", "nude", "null", "numb", "nuts", "oath", "obey", "odds", "omen", "omit", "once", "only", "onto", "open", "oral", "oven", "over", "owed", "owes", "owns", "pace", "pack", "page", "paid", "pail", "pain", "pair", "pale", "palm", "pane", "pant", "park", "part", "pass", "past", "path", "pave", "pawn", "peak", "pear", "peat", "peck", "peel", "peer", "pelt", "pens", "perk", "perm", "pest", "pick", "pier", "pike", "pile", "pill", "pine", "pink", "pint", "pipe", "pity", "plan", "play", "plea", "plod", "plot", "plow", "ploy", "plug", "plum", "plus", "pock", "poem", "poet", "poke", "pole", "poll", "polo", "pomp", "pond", "pony", "pool", "poor", "pope", "pore", "pork", "port", "pose", "posh", "post", "pour", "pout", "pray", "prep", "prey", "prim", "prod", "prop", "prow", "puck", "pull", "pulp", "pump", "punk", "puns", "pure", "push", "quit", "quiz", "race", "rack", "raft", "rage", "raid", "rail", "rain", "rake", "ramp", "rang", "rank", "rant", "rare", "rash", "rasp", "rate", "rave", "rays", "read", "real", "ream", "reap", "rear", "reef", "reel", "rely", "rend", "rent", "rest", "rice", "rich", "ride", "rift", "rind", "ring", "riot", "ripe", "rise", "risk", "rite", "road", "roam", "roar", "robe", "rock", "rode", "role", "roll", "roof", "room", "root", "rope", "rose", "rosy", "rout", "rove", "rude", "ruin", "rule", "rump", "rung", "runs", "rush", "rust", "sack", "safe", "sage", "said", "sail", "sake", "sale", "salt", "same", "sand", "sane", "sang", "sank", "save", "scab", "scan", "scar", "seal", "seam", "sear", "seas", "seat", "sect", "seed", "seek", "seem", "seen", "self", "sell", "send", "sent", "sept", "sere", "serf", "sess", "sets", "sewn", "shed", "shim", "shin", "ship", "shoe", "shoo", "shop", "shot", "show", "shun", "shut", "sick", "side", "sift", "sigh", "sign", "silk", "silo", "sine", "sing", "sink", "site", "size", "skim", "skin", "skip", "slab", "slag", "slam", "slap", "slat", "slay", "sled", "slew", "slid", "slim", "slip", "slit", "slob", "slop", "slot", "slow", "slug", "slum", "slur", "smog", "snap", "snob", "snow", "snub", "snug", "soak", "soap", "soar", "sock", "soda", "sofa", "soft", "soil", "sold", "sole", "some", "song", "soon", "soot", "sore", "sort", "soul", "soup", "sour", "span", "spar", "spat", "spec", "sped", "spin", "spit", "spot", "spun", "spur", "stab", "stag", "star", "stay", "stem", "step", "stew", "stir", "stop", "stub", "stud", "stun", "suck", "suds", "suit", "sulk", "sung", "sunk", "sure", "surf", "swab", "swam", "swan", "swap", "sway", "swim", "sync", "tack", "tact", "tail", "take", "tale", "talk", "tall", "tame", "tank", "tape", "task", "team", "tear", "teem", "tell", "temp", "tend", "tens", "tent", "term", "test", "text", "than", "that", "thaw", "them", "then", "they", "thin", "this", "thus", "tick", "tide", "tidy", "tied", "tier", "tile", "till", "tilt", "time", "tint", "tiny", "tips", "tire", "toad", "toes", "toil", "told", "toll", "tomb", "tone", "tons", "took", "tool", "tops", "tore", "torn", "tort", "toss", "tour", "town", "toys", "tram", "trap", "tray", "tree", "trek", "trim", "trio", "trip", "trod", "trot", "true", "tube", "tuck", "tuna", "tune", "turf", "turn", "tusk", "tutu", "twig", "twin", "type", "ugly", "undo", "unit", "unto", "upon", "urge", "used", "user", "uses", "vain", "vale", "vane", "vary", "vase", "vast", "veal", "veer", "veil", "vein", "vent", "verb", "very", "vest", "veto", "vice", "vied", "view", "vile", "vine", "visa", "vita", "void", "volt", "vote", "wade", "wage", "wait", "wake", "walk", "wall", "wand", "want", "ward", "warm", "warn", "warp", "wary", "wash", "wasp", "wave", "wavy", "waxy", "ways", "weak", "wear", "weed", "week", "weep", "weld", "well", "went", "wept", "were", "west", "what", "when", "whim", "whip", "whir", "whom", "wick", "wide", "wife", "wild", "will", "wilt", "wily", "wimp", "wind", "wine", "wing", "wink", "wipe", "wire", "wiry", "wise", "wish", "wisp", "with", "wits", "woke", "wolf", "womb", "wont", "wood", "woof", "wool", "word", "wore", "work", "worm", "worn", "wove", "wrap", "wren", "yank", "yard", "yarn", "yeah", "year", "yell", "your", "yuck", "zeal", "zero", "zest", "zinc", "zone", "zoom",
  "about", "above", "abuse", "actor", "adapt", "admit", "adopt", "adult", "after", "again", "agent", "agree", "ahead", "alarm", "album", "alien", "align", "alike", "alive", "allow", "alone", "along", "alter", "amaze", "among", "anger", "angle", "angry", "apart", "apple", "apply", "argue", "arise", "armor", "array", "arrow", "aside", "asset", "avoid", "awake", "award", "aware", "awful", "basic", "beach", "beast", "begin", "being", "below", "bench", "blend", "bless", "blind", "block", "blood", "blown", "board", "boast", "bonus", "booth", "bound", "brain", "brand", "brave", "bread", "break", "breed", "brick", "bride", "brief", "bring", "broad", "broke", "brook", "broom", "brown", "brush", "build", "bunch", "buyer", "cabin", "cable", "camel", "candy", "cargo", "carry", "catch", "cause", "chain", "chair", "chalk", "champ", "chant", "chaos", "charm", "chart", "chase", "cheap", "check", "cheek", "cheer", "chess", "chest", "chief", "child", "chill", "china", "choir", "chord", "chunk", "cinch", "claim", "class", "clean", "clear", "clerk", "click", "cliff", "climb", "clock", "close", "cloth", "cloud", "coach", "coast", "colon", "color", "comet", "coral", "couch", "could", "count", "court", "cover", "crack", "craft", "crane", "crash", "crawl", "crazy", "cream", "crest", "crime", "crisp", "cross", "crowd", "crown", "crude", "cruel", "crush", "curve", "cycle", "daily", "dance", "death", "debut", "decay", "decor", "delay", "demon", "dense", "depth", "derby", "deter", "diary", "diner", "dirty", "disco", "ditch", "dizzy", "dough", "doubt", "dozen", "draft", "drain", "drama", "drape", "drawl", "dread", "dream", "dress", "dried", "drift", "drill", "drink", "drive", "drown", "drunk", "dryer", "dwell", "dying", "eager", "eagle", "early", "earth", "eight", "elder", "elect", "elite", "empty", "enemy", "enjoy", "enter", "entry", "equal", "equip", "erase", "error", "essay", "evade", "event", "every", "exact", "exist", "extra", "fable", "facet", "faint", "faith", "false", "fancy", "farce", "fatal", "fatty", "fault", "favor", "feast", "fence", "ferry", "fetch", "fever", "fiber", "field", "fiery", "fifth", "fifty", "fight", "filth", "final", "first", "fixed", "flair", "flame", "flank", "flash", "flask", "fleet", "flesh", "flick", "fling", "flint", "float", "flock", "flood", "floor", "flora", "flour", "fluid", "flush", "focal", "focus", "foggy", "force", "forge", "forum", "found", "frame", "frank", "fraud", "freak", "fresh", "fried", "front", "frost", "fruit", "fully", "fungi", "funny", "fuzzy", "giant", "giddy", "given", "gland", "glass", "gleam", "glide", "globe", "gloom", "glory", "gloss", "glove", "going", "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass", "grave", "graze", "great", "greed", "green", "greet", "grief", "grill", "grind", "groan", "groom", "gross", "group", "grove", "growl", "grown", "guard", "guess", "guest", "guide", "guild", "guilt", "guise", "gulch", "gummy", "habit", "hands", "handy", "happy", "hardy", "harsh", "haste", "hasty", "hatch", "haunt", "haven", "heart", "heavy", "hedge", "heist", "hello", "hence", "hired", "hobby", "hoist", "honey", "honor", "horse", "hotel", "hound", "house", "hover", "human", "humid", "humor", "hurry", "ideal", "image", "imply", "inbox", "incur", "index", "indie", "infer", "inner", "input", "inter", "intro", "issue", "ivory", "jolly", "joust", "judge", "juice", "juicy", "jumbo", "jumpy", "knack", "knead", "knife", "knock", "known", "label", "labor", "lance", "large", "laser", "latch", "later", "laugh", "layer", "leach", "learn", "lease", "least", "leave", "ledge", "legal", "lemon", "level", "lever", "light", "limit", "linen", "liner", "lingo", "lipid", "liter", "lithe", "liver", "llama", "local", "lodge", "logic", "loose", "lorry", "loser", "lotus", "lousy", "lover", "lower", "loyal", "lucid", "lucky", "lunar", "lunch", "lunge", "lyric", "macho", "magic", "major", "maker", "manga", "manor", "maple", "march", "match", "maxim", "maybe", "mayor", "meant", "medal", "media", "melee", "melon", "mercy", "merge", "merit", "merry", "messy", "metal", "meter", "micro", "midst", "might", "mince", "miner", "minor", "minus", "mirth", "misty", "mixed", "mixer", "model", "moist", "money", "month", "moose", "moral", "moron", "morph", "motor", "motto", "mound", "mount", "mouse", "mouth", "mover", "movie", "muddy", "mural", "music", "musty", "naive", "naked", "nasty", "naval", "niche", "night", "noble", "noise", "noisy", "nomad", "north", "notch", "noted", "novel", "nudge", "nurse", "nylon", "occur", "ocean", "offer", "often", "older", "olive", "omega", "onset", "opera", "optic", "orbit", "order", "organ", "other", "ought", "ounce", "outer", "owner", "oxide", "ozone", "paint", "panda", "panel", "panic", "paper", "party", "pasta", "paste", "patch", "patio", "pause", "peace", "peach", "pearl", "pedal", "penny", "perch", "peril", "perky", "petal", "petty", "phase", "phone", "photo", "piano", "piece", "pilot", "pinch", "pitch", "pivot", "pixel", "pizza", "place", "plain", "plane", "plant", "plate", "plaza", "plead", "pleat", "plier", "pluck", "plumb", "plump", "plunk", "point", "polar", "poise", "poker", "porch", "poser", "posse", "pound", "power", "prank", "press", "price", "pride", "prime", "print", "prior", "prism", "prize", "probe", "prone", "proof", "prose", "proud", "prove", "prowl", "proxy", "prude", "prune", "psalm", "pulse", "punch", "pupil", "puppy", "purse", "quack", "quake", "qualm", "queen", "query", "quest", "queue", "quick", "quiet", "quilt", "quirk", "quota", "quote", "rabid", "racer", "radar", "radio", "rally", "ranch", "range", "rapid", "raven", "razor", "reach", "react", "ready", "realm", "rebel", "refer", "reign", "relax", "relay", "relic", "renew", "repay", "reply", "resin", "retro", "rider", "ridge", "rifle", "rigid", "ripen", "risen", "risky", "rival", "river", "roast", "robot", "rocky", "rogue", "roman", "roots", "rough", "round", "royal", "rural", "rusty", "saint", "salad", "salon", "sandy", "sauce", "savor", "scale", "scare", "scarf", "scary", "scene", "scent", "score", "scout", "scrap", "seize", "sense", "serve", "seven", "shade", "shake", "shall", "shame", "shape", "share", "shark", "sharp", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine", "shiny", "shirt", "shock", "shore", "short", "shout", "shown", "shrug", "sight", "sigma", "silly", "since", "sixth", "sixty", "sized", "skill", "skirt", "skull", "slash", "slave", "sleep", "slice", "slide", "slope", "slump", "small", "smart", "smell", "smile", "smoke", "snake", "solar", "solid", "solve", "sorry", "sound", "south", "space", "spare", "spark", "speak", "speed", "spell", "spend", "spent", "spice", "spicy", "spine", "split", "spoke", "spoon", "sport", "spray", "squad", "stack", "staff", "stage", "stain", "stake", "stamp", "stand", "stare", "start", "state", "steak", "steal", "steam", "steel", "steep", "steer", "stern", "stick", "stiff", "still", "stock", "stone", "stood", "stool", "store", "storm", "story", "stout", "stove", "strap", "straw", "strip", "stuck", "study", "stuff", "style", "sugar", "suite", "super", "swear", "sweat", "sweep", "sweet", "swift", "swing", "sword", "table", "taken", "taste", "tasty", "teach", "teeth", "tense", "tenth", "thank", "their", "theme", "there", "these", "thick", "thief", "thing", "think", "third", "thorn", "those", "three", "threw", "throw", "thumb", "tiger", "tight", "timer", "tired", "title", "toast", "today", "token", "tooth", "topic", "torch", "total", "touch", "tough", "tower", "toxic", "trace", "track", "trade", "trail", "train", "trait", "trash", "treat", "trend", "trial", "tribe", "trick", "tried", "troop", "truck", "truly", "trunk", "trust", "truth", "tumor", "tuned", "twice", "twist", "ultra", "uncle", "under", "union", "unity", "until", "upper", "upset", "urban", "usage", "usual", "utter", "valid", "value", "valve", "vapor", "vault", "venue", "verse", "video", "vigor", "vinyl", "viral", "virus", "visit", "vital", "vivid", "vocal", "vodka", "voice", "voter", "waste", "watch", "water", "weary", "weave", "wedge", "weigh", "weird", "whale", "wheat", "wheel", "where", "which", "while", "whine", "white", "whole", "whose", "widen", "wider", "widow", "width", "witch", "woman", "women", "works", "world", "worry", "worse", "worst", "worth", "would", "wound", "wrath", "write", "wrong", "wrote", "yacht", "yield", "young", "yours", "youth", "zebra", "zones",
  "accept", "access", "across", "action", "active", "actual", "advice", "advise", "affair", "affect", "afford", "afraid", "agency", "agenda", "almost", "always", "amount", "animal", "annual", "answer", "anyone", "appear", "around", "arrive", "artist", "aspect", "assume", "attack", "attend", "author", "avenue", "battle", "beauty", "became", "become", "before", "behalf", "behind", "belief", "belong", "beside", "better", "beyond", "bigger", "border", "bother", "bottom", "bought", "branch", "bridge", "bright", "brings", "broken", "budget", "burden", "button", "called", "camera", "campus", "cancer", "cannot", "career", "castle", "caught", "center", "centre", "chance", "change", "charge", "choice", "choose", "church", "circle", "client", "closed", "closer", "column", "combat", "coming", "common", "county", "couple", "course", "covers", "create", "credit", "crisis", "custom", "damage", "danger", "debate", "decade", "decide", "deeply", "defeat", "defend", "define", "degree", "demand", "depend", "desert", "design", "desire", "detail", "detect", "device", "dinner", "direct", "doctor", "dollar", "domain", "double", "driven", "driver", "during", "easily", "eating", "editor", "effect", "effort", "either", "emerge", "employ", "enable", "ending", "energy", "engage", "engine", "enough", "ensure", "entire", "entity", "equity", "escape", "estate", "ethnic", "exceed", "except", "expand", "expect", "expert", "export", "extend", "extent", "fabric", "factor", "fairly", "fallen", "family", "famous", "father", "fellow", "figure", "filing", "finger", "finish", "flight", "flower", "flying", "follow", "forced", "forest", "forget", "formal", "format", "former", "freeze", "friend", "frozen", "future", "garden", "gather", "gender", "genius", "global", "golden", "gotten", "ground", "growth", "guilty", "hammer", "handle", "happen", "hardly", "headed", "health", "heaven", "height", "hidden", "highly", "honest", "hoping", "horror", "hunter", "ignore", "impact", "import", "impose", "income", "indeed", "inform", "injury", "inside", "invest", "island", "itself", "jersey", "junior", "keeper", "killer", "labour", "latest", "latter", "launch", "lawyer", "leader", "league", "legend", "length", "lesson", "letter", "likely", "linear", "linked", "liquid", "listen", "little", "living", "losing", "luxury", "making", "manage", "manner", "manual", "margin", "marine", "market", "master", "matter", "medium", "member", "memory", "mental", "merely", "method", "middle", "miller", "mining", "minute", "mirror", "mobile", "modern", "modest", "moment", "mother", "motion", "moving", "murder", "museum", "mutual", "myself", "namely", "nation", "native", "nature", "nearby", "nearly", "needed", "negate", "nickel", "nobody", "normal", "notice", "notion", "number", "object", "obtain", "occupy", "office", "oldest", "online", "option", "orange", "origin", "output", "oxford", "packet", "palace", "parade", "parent", "patent", "patrol", "patron", "paying", "people", "period", "permit", "person", "phrase", "picked", "planet", "player", "please", "pledge", "plenty", "pocket", "poetry", "police", "policy", "polish", "poster", "potato", "prefer", "pretty", "prince", "prison", "profit", "proper", "proven", "public", "pursue", "puzzle", "racial", "random", "rarely", "rather", "rating", "reader", "really", "reason", "recall", "recent", "record", "reduce", "reform", "refuse", "regard", "region", "relate", "relief", "remain", "remind", "remote", "remove", "render", "repeat", "report", "rescue", "resist", "resort", "result", "retail", "retain", "retire", "return", "reveal", "review", "reward", "rights", "rising", "robust", "ruling", "runner", "sacred", "safely", "safety", "salary", "sample", "saving", "saying", "scared", "scheme", "school", "screen", "search", "season", "second", "secret", "sector", "secure", "seeing", "seeing", "select", "seller", "senate", "senior", "sensor", "series", "server", "settle", "severe", "shadow", "should", "shower", "signed", "silent", "silver", "simple", "simply", "single", "sister", "slight", "smooth", "soccer", "social", "sodium", "solely", "solved", "sought", "source", "sphere", "spirit", "spread", "spring", "square", "stable", "statue", "status", "steady", "strain", "strand", "stream", "street", "stress", "strict", "strike", "string", "strong", "struck", "studio", "stupid", "submit", "subtle", "suburb", "sudden", "suffer", "summer", "summit", "supply", "surely", "survey", "switch", "symbol", "system", "tablet", "taking", "talent", "target", "taught", "temple", "tender", "tennis", "terror", "thanks", "theory", "thirty", "though", "thread", "threat", "throne", "thrown", "ticket", "timber", "timing", "tissue", "toilet", "tongue", "toward", "travel", "treaty", "tribes", "tunnel", "turkey", "twelve", "twenty", "unable", "unique", "united", "unless", "unlike", "update", "useful", "valley", "varied", "vendor", "victim", "virgin", "virtue", "vision", "visual", "volume", "voting", "walker", "wallet", "warmth", "wealth", "weapon", "weekly", "weight", "wholly", "widely", "window", "winner", "winter", "wisdom", "within", "wonder", "wooden", "worker", "worthy", "writer", "yellow",
];

const DICTIONARY = new Set(COMMON_WORDS);

const VOWELS = "AEIOU";
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";

const getRandomLetters = (): string[] => {
  const letters: string[] = [];
  
  const vowelCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < vowelCount; i++) {
    letters.push(VOWELS[Math.floor(Math.random() * VOWELS.length)]);
  }
  
  while (letters.length < 7) {
    letters.push(CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]);
  }
  
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  
  return letters;
};

const canFormWord = (word: string, availableLetters: string[]): boolean => {
  const letterCounts = new Map<string, number>();
  for (const letter of availableLetters) {
    letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
  }
  
  for (const char of word.toUpperCase()) {
    const count = letterCounts.get(char) || 0;
    if (count === 0) return false;
    letterCounts.set(char, count - 1);
  }
  
  return true;
};

const isValidWordLocal = (word: string): boolean => {
  return word.length >= 2 && DICTIONARY.has(word.toLowerCase());
};

const getWordScore = (word: string): number => {
  const len = word.length;
  if (len <= 2) return 1;
  if (len === 3) return 3;
  if (len === 4) return 5;
  if (len === 5) return 8;
  if (len === 6) return 12;
  return 15 + (len - 7) * 3;
};

const findAIWords = (letters: string[], maxWords: number = 5): string[] => {
  const foundWords: string[] = [];
  const wordsToCheck = [...COMMON_WORDS].sort(() => Math.random() - 0.5);
  
  for (const word of wordsToCheck) {
    if (foundWords.length >= maxWords) break;
    if (word.length >= 3 && canFormWord(word, letters) && !foundWords.includes(word)) {
      foundWords.push(word);
    }
  }
  
  return foundWords.sort((a, b) => b.length - a.length);
};

export default function WordBattleGame({ stake, onGameEnd, isPractice }: WordBattleGameProps) {
  const [letters, setLetters] = useState<string[]>([]);
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [aiWords, setAIWords] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [gamePhase, setGamePhase] = useState<"loading" | "playing" | "ai_turn" | "results">("loading");
  const [message, setMessage] = useState("");
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAIScore] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [letterHint, setLetterHint] = useState<string | null>(null);
  const [funFact, setFunFact] = useState<string | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAILetters = async () => {
    try {
      const response = await fetch("/api/games/generate-letters");
      if (!response.ok) throw new Error("Failed to fetch letters");
      
      const data: LetterGenerationResult = await response.json();
      setLetters(data.letters);
      setLetterHint(data.hint || null);
      setAiPowered(!data.usedFallback);
      setGamePhase("playing");
    } catch (error) {
      console.error("Error fetching AI letters:", error);
      setLetters(getRandomLetters());
      setAiPowered(false);
      setGamePhase("playing");
    }
  };

  useEffect(() => {
    fetchAILetters();
  }, []);

  useEffect(() => {
    if (gamePhase === "playing") {
      inputRef.current?.focus();
    }
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== "playing" || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGamePhase("ai_turn");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gamePhase, timeLeft]);

  useEffect(() => {
    if (gamePhase === "ai_turn") {
      setMessage("AI is finding words...");
      
      setTimeout(() => {
        const aiFoundWords = findAIWords(letters, 3 + Math.floor(Math.random() * 3));
        const filteredAIWords = aiFoundWords.filter((w) => !playerWords.includes(w.toUpperCase()));
        
        let totalAIScore = 0;
        const wordsToShow: string[] = [];
        
        const showNextWord = (index: number) => {
          if (index >= filteredAIWords.length) {
            setAIScore(totalAIScore);
            setTimeout(() => {
              setGamePhase("results");
            }, 500);
            return;
          }
          
          const word = filteredAIWords[index];
          wordsToShow.push(word);
          setAIWords([...wordsToShow]);
          totalAIScore += getWordScore(word);
          
          setTimeout(() => showNextWord(index + 1), 400);
        };
        
        showNextWord(0);
      }, 1000);
    }
  }, [gamePhase, letters, playerWords]);

  useEffect(() => {
    if (gamePhase === "results") {
      const playerWon = playerScore > aiScore;
      onGameEnd(playerWon, playerScore);
    }
  }, [gamePhase, playerScore, aiScore, onGameEnd]);

  const handleLetterClick = (letter: string, index: number) => {
    if (gamePhase !== "playing" || isValidating) return;
    
    if (selectedIndices.includes(index)) {
      setSelectedIndices((prev) => prev.filter((i) => i !== index));
      setCurrentWord((prev) => {
        const pos = selectedIndices.indexOf(index);
        return prev.slice(0, pos) + prev.slice(pos + 1);
      });
    } else {
      setSelectedIndices((prev) => [...prev, index]);
      setCurrentWord((prev) => prev + letter);
    }
  };

  const validateWordWithAI = async (word: string): Promise<WordValidationResult> => {
    try {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response as WordValidationResult;
    } catch (error) {
      console.error("Error validating word:", error);
      const isValid = isValidWordLocal(word);
      return {
        valid: isValid,
        feedback: isValid ? "Word accepted!" : "Not a valid word.",
        usedFallback: true
      };
    }
  };

  const handleSubmitWord = async () => {
    if (gamePhase !== "playing" || isValidating) return;
    
    const word = currentWord.toUpperCase();
    
    if (word.length < 2) {
      setMessage("Word must be at least 2 letters!");
      return;
    }
    
    if (playerWords.includes(word)) {
      setMessage("You already used that word!");
      setCurrentWord("");
      setSelectedIndices([]);
      return;
    }
    
    if (!canFormWord(word, letters)) {
      setMessage("You can only use available letters!");
      setCurrentWord("");
      setSelectedIndices([]);
      return;
    }
    
    setIsValidating(true);
    setMessage("Checking word...");
    setFunFact(null);
    
    try {
      const result = await validateWordWithAI(word);
      
      if (!result.valid) {
        setMessage(result.feedback || "Not a valid word!");
        setCurrentWord("");
        setSelectedIndices([]);
        setIsValidating(false);
        setTimeout(() => setMessage(""), 2500);
        return;
      }
      
      const score = getWordScore(word);
      setPlayerWords((prev) => [...prev, word]);
      setPlayerScore((prev) => prev + score);
      
      if (result.funFact) {
        setFunFact(result.funFact);
        setMessage(`+${score} points! ${result.feedback || ""}`);
        setTimeout(() => {
          setFunFact(null);
          setMessage("");
        }, 4000);
      } else {
        setMessage(`+${score} points! ${result.feedback || ""}`);
        setTimeout(() => setMessage(""), 2000);
      }
      
      setCurrentWord("");
      setSelectedIndices([]);
    } catch (error) {
      if (isValidWordLocal(word)) {
        const score = getWordScore(word);
        setPlayerWords((prev) => [...prev, word]);
        setPlayerScore((prev) => prev + score);
        setMessage(`+${score} points!`);
        setTimeout(() => setMessage(""), 1500);
      } else {
        setMessage("Not a valid word!");
        setTimeout(() => setMessage(""), 1500);
      }
      setCurrentWord("");
      setSelectedIndices([]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmitWord();
    } else if (e.key === "Backspace" && selectedIndices.length > 0) {
      setSelectedIndices((prev) => prev.slice(0, -1));
      setCurrentWord((prev) => prev.slice(0, -1));
    }
  };

  const clearWord = () => {
    setCurrentWord("");
    setSelectedIndices([]);
    setMessage("");
    setFunFact(null);
  };

  const resetGame = async () => {
    setPlayerWords([]);
    setAIWords([]);
    setCurrentWord("");
    setTimeLeft(60);
    setMessage("");
    setPlayerScore(0);
    setAIScore(0);
    setSelectedIndices([]);
    setLetterHint(null);
    setFunFact(null);
    setGamePhase("loading");
    await fetchAILetters();
  };

  const winner = playerScore > aiScore ? "player" : playerScore < aiScore ? "ai" : "tie";

  if (gamePhase === "loading") {
    return (
      <div className="w-full max-w-lg mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-8 w-8 text-primary" />
            </motion.div>
            <p className="text-muted-foreground">AI is preparing your letters...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              Word Battle
              {aiPowered && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Zap className="h-3 w-3" />
                  AI-Powered
                </Badge>
              )}
              {!isPractice && (
                <Badge variant="secondary" className="text-xs">
                  Stake: {stake} NGN
                </Badge>
              )}
              {isPractice && (
                <Badge variant="outline" className="text-xs">
                  Practice
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20">
                <Clock className="h-3 w-3 mr-1" />
                {timeLeft}s
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-bold">{playerScore}</span>
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
            <Progress value={(timeLeft / 60) * 100} className="flex-1 h-2" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">pts</span>
              <span className="font-bold">{aiScore}</span>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {letterHint && gamePhase === "playing" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-sm"
            >
              <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">{letterHint}</span>
            </motion.div>
          )}

          <div className="flex flex-wrap justify-center gap-2 p-4 bg-muted/30 rounded-md">
            {letters.map((letter, index) => (
              <motion.button
                key={index}
                className={`w-12 h-12 rounded-md font-bold text-xl border-2 transition-colors
                  ${selectedIndices.includes(index) 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card border-border"
                  }
                  ${isValidating ? "opacity-50 cursor-not-allowed" : ""}`}
                whileHover={{ scale: isValidating ? 1 : 1.05 }}
                whileTap={{ scale: isValidating ? 1 : 0.95 }}
                onClick={() => handleLetterClick(letter, index)}
                disabled={gamePhase !== "playing" || isValidating}
                data-testid={`letter-${index}`}
              >
                {letter}
              </motion.button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={currentWord}
                onChange={(e) => {
                  if (isValidating) return;
                  const newWord = e.target.value.toUpperCase();
                  if (newWord.length > currentWord.length) {
                    const newChar = newWord[newWord.length - 1];
                    const availableIndex = letters.findIndex((l, i) => l === newChar && !selectedIndices.includes(i));
                    if (availableIndex !== -1) {
                      setSelectedIndices((prev) => [...prev, availableIndex]);
                      setCurrentWord(newWord);
                    }
                  } else {
                    setCurrentWord(newWord);
                    setSelectedIndices(selectedIndices.slice(0, newWord.length));
                  }
                }}
                onKeyDown={handleKeyPress}
                placeholder="Type or click letters..."
                className="flex-1 text-center font-bold uppercase"
                disabled={gamePhase !== "playing" || isValidating}
                data-testid="input-word"
              />
              <Button
                onClick={clearWord}
                variant="outline"
                size="icon"
                disabled={gamePhase !== "playing" || isValidating}
                data-testid="button-clear"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSubmitWord}
                disabled={gamePhase !== "playing" || currentWord.length < 2 || isValidating}
                data-testid="button-submit-word"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  key="message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className={`text-sm font-medium ${
                    message.includes("+") || message.includes("points") 
                      ? "text-green-600 dark:text-green-400" 
                      : message.includes("Checking") 
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }`}>
                    {isValidating && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                    {message}
                  </p>
                </motion.div>
              )}
              {funFact && (
                <motion.div
                  key="funfact"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 p-2 bg-muted/50 rounded-md"
                >
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{funFact}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Your Words ({playerWords.length})
              </div>
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="space-y-1">
                  {playerWords.map((word, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono">{word}</span>
                      <Badge variant="secondary" className="text-xs">
                        +{getWordScore(word)}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4" />
                AI Words ({aiWords.length})
              </div>
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="space-y-1">
                  {aiWords.map((word, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono uppercase">{word}</span>
                      <Badge variant="secondary" className="text-xs">
                        +{getWordScore(word)}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {gamePhase === "results" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 p-4 bg-muted/50 rounded-md"
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className={`h-8 w-8 ${winner === "player" ? "text-yellow-500" : winner === "tie" ? "text-muted-foreground" : "text-muted-foreground"}`} />
                <p className="text-xl font-bold">
                  {winner === "player" ? "You Won!" : winner === "tie" ? "It's a Tie!" : "AI Won!"}
                </p>
              </div>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold">{playerScore}</p>
                  <p className="text-sm text-muted-foreground">Your Score</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{aiScore}</p>
                  <p className="text-sm text-muted-foreground">AI Score</p>
                </div>
              </div>
              {!isPractice && (
                <p className="text-sm text-muted-foreground">
                  {winner === "player" 
                    ? `You earned ${stake * 2 * 0.95} NGN!` 
                    : winner === "tie"
                    ? "Stakes returned."
                    : `You lost ${stake} NGN.`}
                </p>
              )}
              <Button onClick={resetGame} variant="outline" data-testid="button-play-again">
                <RotateCcw className="h-4 w-4 mr-2" />
                Play Again
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
