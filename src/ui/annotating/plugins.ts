// Every kind's plugin, imported for its registration.
//
// A plugin registers itself when its module is evaluated, so this is the one place the
// view learns which kinds exist — a line per kind. It is the view's counterpart of
// `domain/annotation/kinds.ts`, and adding a kind is a line in each.
//
// Nothing else here: a plugin's own file says what it is, and this only makes sure it
// is loaded.

import './arrow-plugin.js';
import './image-plugin.js';
import './sound-plugin.js';
import './text-plugin.js';