import React, { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from "codemirror"
import { EditorState, StateEffect, StateField } from "@codemirror/state"
import { Decoration } from "@codemirror/view"
import { StreamLanguage } from "@codemirror/language"
import { stex } from "@codemirror/legacy-modes/mode/stex"

/*
 * The failing line, held in the editor's own state rather than in React.
 *
 * CodeMirror owns its DOM, so marking a line has to go through a transaction —
 * re-rendering the component cannot reach inside it. A StateField that maps its
 * decoration through document changes means the mark follows the line as the user
 * types above it, instead of pointing at whatever text later slid into that
 * position, which would be worse than not marking it at all.
 */
const setErrorLine = StateEffect.define()

const errorLineField = StateField.define({
    create: () => Decoration.none,
    update(marks, tr) {
        marks = marks.map(tr.changes)
        for (const effect of tr.effects) {
            if (!effect.is(setErrorLine)) continue
            if (effect.value == null) {
                marks = Decoration.none
            } else {
                // Clamp: TeX can report a line past the end of the document (it
                // often fails at \end{document}), and asking CodeMirror for a line
                // that does not exist throws.
                const lineNo = Math.min(Math.max(effect.value, 1), tr.state.doc.lines)
                const line = tr.state.doc.line(lineNo)
                marks = Decoration.set([
                    Decoration.line({ class: "cm-errorLine" }).range(line.from)
                ])
            }
        }
        return marks
    },
    provide: (field) => EditorView.decorations.from(field),
})

/**
 * A LaTeX source editor. Uncontrolled by design: CodeMirror holds the document
 * and reports changes upward, because driving its text from React state on every
 * keystroke fights the editor for cursor position and undo history — the two
 * things a text editor must never get wrong.
 */
const LatexEditor = ({ value, onChange, errorLine }) => {
    const hostRef = useRef(null)
    const viewRef = useRef(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    useEffect(() => {
        const view = new EditorView({
            parent: hostRef.current,
            state: EditorState.create({
                doc: value ?? "",
                extensions: [
                    basicSetup,
                    StreamLanguage.define(stex),
                    errorLineField,
                    EditorView.lineWrapping,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            // through a ref so a new onChange identity does not tear
                            // down and rebuild the editor, losing cursor and history
                            onChangeRef.current?.(update.state.doc.toString())
                        }
                    }),
                ],
            }),
        })

        viewRef.current = view
        return () => { view.destroy(); viewRef.current = null }
        // Mounted once. `value` is the initial document only — see below for the
        // one case where an outside change is pushed in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* Only when the incoming value genuinely differs from what the editor holds —
       i.e. the source was replaced from outside (reverted to generated), not
       echoed back from the user's own typing. Without that guard every keystroke
       would round-trip and reset the cursor to the end. */
    useEffect(() => {
        const view = viewRef.current
        if (!view) return
        const current = view.state.doc.toString()
        if (value != null && value !== current) {
            view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
        }
    }, [value])

    useEffect(() => {
        viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine ?? null) })
    }, [errorLine])

    return <div className="latex" ref={hostRef} />
}

export default LatexEditor
