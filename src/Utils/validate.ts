/**
 * Schema validation.
 *
 * The composition pipeline assumes a well-formed schema: known layer/item
 * types, unique item ids (they key `itemsMap`), numeric timing, and a `url`
 * for anything that loads an external file. When those assumptions are broken
 * the failure used to surface deep inside FFmpeg as a cryptic filtergraph
 * error — or silently, when a duplicate id overwrote an earlier item.
 *
 * `validateSchema` collects *all* problems and throws a single readable error
 * up front, so callers learn what to fix before a render is ever started.
 */

const LAYER_TYPES = ['audio', 'normal', 'text', 'lottie'];
const ITEM_TYPES = ['video', 'audio', 'image', 'text', 'lottie'];
// Item types that pull in an external resource and therefore need a `url`.
const URL_ITEM_TYPES = ['video', 'audio', 'image'];

export class DramaSchemaError extends Error {
    constructor(problems: string[]) {
        super('DramaDirector: invalid schema:\n  - ' + problems.join('\n  - '));
        this.name = 'DramaSchemaError';
    }
}

export function validateSchema(schema: DramaSchema): void {
    if (!schema || typeof schema !== 'object') {
        throw new DramaSchemaError(['schema must be an object.']);
    }

    const errors: string[] = [];

    if (typeof schema.w !== 'number' || schema.w <= 0) {
        errors.push(`schema.w must be a positive number (got ${JSON.stringify(schema.w)}).`);
    }
    if (typeof schema.h !== 'number' || schema.h <= 0) {
        errors.push(`schema.h must be a positive number (got ${JSON.stringify(schema.h)}).`);
    }
    if (schema.d != null && (typeof schema.d !== 'number' || schema.d < 0)) {
        errors.push(`schema.d must be a non-negative number when provided (got ${JSON.stringify(schema.d)}).`);
    }

    if (!Array.isArray(schema.layers)) {
        errors.push('schema.layers must be an array.');
        throw new DramaSchemaError(errors);
    }

    // Maps an item id to the layer index that first declared it, so a
    // duplicate can point at its collision.
    const seenIds = new Map<string, number>();

    schema.layers.forEach((layer, li) => {
        const where = `layers[${li}]`;
        if (!layer || typeof layer !== 'object') {
            errors.push(`${where} must be an object.`);
            return;
        }
        if (!LAYER_TYPES.includes(layer.type)) {
            errors.push(
                `${where}.type ${JSON.stringify(layer.type)} is not supported ` +
                `(expected one of: ${LAYER_TYPES.join(', ')}).`
            );
        }
        if (typeof layer.index !== 'number') {
            errors.push(`${where}.index must be a number.`);
        }
        if (!Array.isArray(layer.items)) {
            errors.push(`${where}.items must be an array.`);
            return;
        }

        layer.items.forEach((item, ii) => {
            const at = `${where}.items[${ii}]`;
            if (!item || typeof item !== 'object') {
                errors.push(`${at} must be an object.`);
                return;
            }

            if (!ITEM_TYPES.includes(item.type)) {
                errors.push(
                    `${at}.type ${JSON.stringify(item.type)} is not supported ` +
                    `(expected one of: ${ITEM_TYPES.join(', ')}).`
                );
            }

            if (item.id != null) {
                const prev = seenIds.get(item.id);
                if (prev !== undefined) {
                    errors.push(
                        `${at}.id ${JSON.stringify(item.id)} is duplicated ` +
                        `(also used in layers[${prev}]); item ids must be unique.`
                    );
                } else {
                    seenIds.set(item.id, li);
                }
            } else if (item.type !== 'lottie') {
                // lottie items are addressed by layer, not id; everything else needs one.
                errors.push(`${at}.id is required.`);
            }

            if (URL_ITEM_TYPES.includes(item.type) && !item.url) {
                errors.push(`${at}.url is required for ${item.type} items.`);
            }
            if (item.type === 'lottie' && !item.lottie) {
                errors.push(`${at}.lottie (animation data) is required for lottie items.`);
            }

            const config = item.config;
            if (!config || typeof config !== 'object') {
                errors.push(`${at}.config must be an object.`);
            } else {
                const stOk = typeof config.st === 'number';
                const etOk = typeof config.et === 'number';
                if (!stOk) errors.push(`${at}.config.st must be a number.`);
                if (!etOk) errors.push(`${at}.config.et must be a number.`);
                if (stOk && etOk && config.et < config.st) {
                    errors.push(
                        `${at}.config.et (${config.et}) must be >= config.st (${config.st}).`
                    );
                }
            }
        });
    });

    if (errors.length) {
        throw new DramaSchemaError(errors);
    }
}
