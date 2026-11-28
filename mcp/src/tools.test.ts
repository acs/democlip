import { describe, expect, it } from 'vitest';

import { findTool, toolDefinitions, toolList } from './tools.js';

// What the server offers is a promise: the app's own operations, named in its words,
// plus the two deliveries the browser's own doors need (the picker's press, and the
// file input). These are the checks that keep that list honest — including how far it
// reaches.

describe('the tool list', () => {
  it('offers one tool per operation, named in the app\u2019s vocabulary', () => {
    expect(toolList().map(tool => tool.name)).toEqual([
      'describe_clip',
      'cut',
      'annotate',
      'add_image',
      'set_property',
      'set_clip_property',
      'remove_annotation',
      'undo',
      'seek',
      'start_take',
      'stop_take',
      'turn_source_on',
      'turn_source_off',
      'import_take',
      'export_clip',
      'publish_clip',
      'list_projects',
      'read_project',
      'create_project',
      'select_project',
      'edit_project',
      'move_recording',
      'list_profiles',
      'create_profile',
      'edit_profile',
    ]);
  });

  it('offers no tool that evaluates code or scripts the page', () => {
    // The guarantee is the list itself: a tool that ran code would have to be named
    // here, and this is the list. Nothing generic, nothing that takes a script.
    // `\bfile` and not `file`: a profile's own name holds "files" without naming a file.
    const forbidden = /eval|exec|script|shell|command|fetch|http|\bfile|write|path/i;
    for (const tool of toolList()) expect(tool.name).not.toMatch(forbidden);
  });

  it('offers no tool that deletes a recording or removes a project', () => {
    // The one boundary the user set for projects: organise, never destroy. Deleting needs the
    // person's confirmation, and is not on the list at all.
    for (const tool of toolList()) {
      expect(tool.name).not.toMatch(/delete|destroy|remove_project/i);
    }
  });

  it('describes every tool with a schema an agent can act on', () => {
    for (const tool of toolList()) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('hands the protocol the names, descriptions and schemas, and no implementation', () => {
    for (const definition of toolDefinitions()) {
      expect(Object.keys(definition).sort()).toEqual(['description', 'inputSchema', 'name']);
    }
  });

  it('finds a tool by name, and nothing for a name it does not offer', () => {
    expect(findTool('describe_clip')?.name).toBe('describe_clip');
    expect(findTool('run_anything')).toBeNull();
  });

  it('names each operation in the app\u2019s words, with the inputs the app takes', () => {
    const byName = new Map(toolList().map(tool => [tool.name, tool]));
    // The stretch a cut or an annotation is shown over is a fraction of the clip,
    // as everywhere else in the app, so a tool call and a person's edit mean the
    // same moment.
    for (const name of ['cut', 'annotate']) {
      const schema = byName.get(name)!.inputSchema;
      expect(schema.type).toBe('object');
    }
    expect(byName.get('cut')!.inputSchema.required).toEqual(['from', 'to']);
    expect(byName.get('add_image')!.inputSchema.required).toEqual(['span']);
    expect(byName.get('set_property')!.inputSchema.required).toEqual(['id', 'property', 'value']);
    // The clip's own properties are not enumerated: the clip is the one that knows
    // them (describe_clip reports its `properties`), so `property` is a plain string
    // and the surface refuses one it does not hold — or one a profile fixes — in
    // words. The schema must not list a subset, which would reject real properties
    // (logo, annotationColour, exportResolution) before the surface ever saw them.
    // There is no id: there is one clip.
    expect(byName.get('set_clip_property')!.inputSchema.required).toEqual(['property', 'value']);
    expect(byName.get('set_clip_property')!.inputSchema.properties!.property).toMatchObject({ type: 'string' });
    expect(byName.get('set_clip_property')!.inputSchema.properties!.property).not.toHaveProperty('enum');
    expect(byName.get('seek')!.inputSchema.required).toEqual(['seconds']);
    expect(byName.get('list_projects')!.inputSchema.required).toEqual([]);
    expect(byName.get('read_project')!.inputSchema.required).toEqual(['project']);
    expect(byName.get('create_project')!.inputSchema).toMatchObject({
      required: ['name'],
      properties: { name: { type: 'string' } },
    });
    expect(byName.get('select_project')!.inputSchema.required).toEqual(['project']);
    expect(byName.get('edit_project')!.inputSchema.required).toEqual(['project']);
    expect(byName.get('move_recording')!.inputSchema.required).toEqual(['recording', 'project']);
    // A profile is made with a name and the items it fixes, changed by name, and listed whole.
    expect(byName.get('list_profiles')!.inputSchema.required).toEqual([]);
    expect(byName.get('create_profile')!.inputSchema).toMatchObject({
      required: ['name'],
      properties: { name: { type: 'string' }, controls: { type: 'object' } },
    });
    expect(byName.get('edit_profile')!.inputSchema).toMatchObject({
      required: ['profile'],
      properties: { profile: { type: 'string' }, controls: { type: 'object' } },
    });
    for (const name of ['turn_source_on', 'turn_source_off']) {
      expect(byName.get(name)!.inputSchema.required).toEqual(['source']);
    }
    // The kinds an agent may make are the ones whose shape is data — and a sound's shape is a
    // *name*, so it is data too, and its sound is one of the app's own with no file to give.
    // An image's shape is data too, but its picture is not: it comes from the clipboard,
    // through its own tool, and is never something the agent invents.
    expect(byName.get('annotate')!.inputSchema.properties).toMatchObject({
      kind: { enum: ['arrow', 'text', 'sound', 'magnifier'] },
    });
    expect(byName.get('add_image')!.inputSchema.properties).toMatchObject({
      span: { type: 'object' },
    });
    // An import takes one file, named as a path — the only path any tool takes.
    expect(byName.get('import_take')!.inputSchema).toMatchObject({
      required: ['path'],
      properties: { path: { type: 'string' } },
    });
    // An export writes one of the two containers the app writes, and says where its
    // annotations go: drawn into the picture, or carried in a sidecar beside it.
    expect(byName.get('export_clip')!.inputSchema).toMatchObject({
      required: ['target'],
      properties: { target: { enum: ['webm', 'mp4'] }, annotations: { enum: ['drawn', 'carried'] } },
    });
    // A publish names where it goes — a post on Bluesky, or a video on YouTube — and
    // one operation gaining a destination is no second tool. The visibility is the app's
    // own three words, and private is where a video starts.
    expect(byName.get('publish_clip')!.inputSchema).toMatchObject({
      properties: {
        destination: { enum: ['bluesky', 'youtube'] },
        visibility: { enum: ['private', 'unlisted', 'public'] },
      },
    });
    expect(byName.get('publish_clip')!.inputSchema.required ?? []).toEqual([]);
  });

  it('offers exactly one tool that names a path, and it is the app\u2019s own Import', () => {
    // The bound is the list itself, so it is spelled out here. One tool may name a file:
    // `import_take` fills the app's own file input, so what it brings in is what the
    // app's own rule accepts, and a person could have chosen the same file by hand.
    // `export_clip` writes a file, but it is the file the *app* writes, taken from the
    // browser's own download; `add_image` reads the person's clipboard, which is not a
    // file and takes no path. A second tool that took a path would fail here, and would
    // have to be argued for rather than slipped in.
    const named = toolList()
      .filter(tool => Object.keys(tool.inputSchema.properties ?? {}).some(key => /^(path|file|dir|directory)$/i.test(key)))
      .map(tool => tool.name);
    expect(named).toEqual(['import_take']);
  });
});
