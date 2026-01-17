export class CardFactory {
  /**
   * Converts a DB Card Record into renderable Variants.
   * @param {Object} cardRecord
   * @returns {Array<{ variantId: string, type: 'qa'|'cloze', front: string, back: string }>}
   */
  static createVariants(cardRecord) {
    const variants = [];
    const { id, question, answer, notes } = cardRecord;

    // 1. Always create QA variant
    variants.push({
      variantId: `${id}::qa`,
      type: 'qa',
      front: question,
      back: `${answer}${notes ? ' <hr> ' + notes : ''}`, // Add notes to back if present
      rowId: id, // Add rowId for easier lookup
    });

    // 2. Check for Cloze variant condition
    const clozeRegex = /(\{\{|\[\[)(.*?)(\}\}|\]\])/g;
    if (notes && clozeRegex.test(notes)) {
      // 3. If match, create Cloze variant
      const clozeFront = notes.replace(clozeRegex, '_____');
      const clozeBack = notes.replace(clozeRegex, '<mark>$2</mark>'); // Highlight content inside markers

      variants.push({
        variantId: `${id}::cloze`,
        type: 'cloze',
        front: clozeFront,
        back: clozeBack,
        rowId: id, // Add rowId for easier lookup
      });
    }

    // 4. Return array
    return variants;
  }
}
