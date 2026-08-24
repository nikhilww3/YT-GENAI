const { ZxcvbnFactory } = require("@zxcvbn-ts/core")
const zxcvbnCommon = require("@zxcvbn-ts/language-common")
const zxcvbnEn = require("@zxcvbn-ts/language-en")

/*
 * @zxcvbn-ts/core v4 removed the v3 `zxcvbn` / `zxcvbnOptions` named exports —
 * it only ships `ZxcvbnFactory` now. Importing the old names yields `undefined`
 * and blows up as "zxcvbn is not a function" at call time.
 *
 * The language packs are not optional: without a dictionary, `password123`
 * scores a perfect 4/4 and the strength gate rejects nothing.
 */
const zxcvbn = new ZxcvbnFactory({
    dictionary: {
        ...zxcvbnCommon.dictionary,
        ...zxcvbnEn.dictionary,
    },
    graphs: zxcvbnCommon.adjacencyGraphs,
    translations: zxcvbnEn.translations,
})

function checkPasswordStrength(password, userInputs = []) {
    return zxcvbn.check(password, userInputs.filter(Boolean))
}

module.exports = { checkPasswordStrength }
