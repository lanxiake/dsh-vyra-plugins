/**
 * Turns the images in a user message into what the CLI can take. The harness keeps
 * images as references to its attachment store; a CLI only understands inline bytes,
 * so each one is read here, just before the prompt goes out.
 * @module vyra-agent-cli-manager/prompt-images
 */
import { LlmError, offloadedImageText, textOnlyImageText } from '@deepseek-ai/dsh-llm';
function imageLabel(ref) {
    return ref.name ?? ref.attachmentId;
}
async function imageBlock(ref, readImage, signal) {
    if (readImage === undefined) {
        throw new LlmError('当前环境没有附件服务，无法把图片发送给 CLI。', 'UNSUPPORTED_CONTENT');
    }
    try {
        const data = await readImage(ref, signal);
        return { type: 'image', mimeType: ref.mediaType, data: Buffer.from(data).toString('base64') };
    }
    catch (error) {
        signal?.throwIfAborted();
        throw new LlmError(`无法读取图片「${imageLabel(ref)}」，这条消息没有发送。`, 'CLI_PROMPT_FAILED', {
            cause: error,
        });
    }
}
function toBlock(block, resolution, signal) {
    if (block.type === 'text')
        return Promise.resolve(block);
    // `ref` is the host's own reference object, so its placeholder texts accept it as is.
    if (block.offloaded)
        return Promise.resolve({ type: 'text', text: offloadedImageText(block.ref) });
    if (!resolution.acceptsImages)
        return Promise.resolve({ type: 'text', text: textOnlyImageText(block.ref) });
    return imageBlock(block.ref, resolution.readImage, signal);
}
/**
 * Resolve user input into ACP prompt blocks, in order.
 * @param blocks - text and image references from the user's messages.
 * @param resolution - whether the CLI takes images and how to read them.
 * @param signal - cancellation for the reads.
 * @returns the prompt to send.
 * @throws LlmError when an image cannot be read; sending without it would hide it from the CLI.
 */
export function toPromptBlocks(blocks, resolution, signal) {
    return Promise.all(blocks.map((block) => toBlock(block, resolution, signal)));
}
