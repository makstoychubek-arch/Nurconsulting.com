import assert from 'node:assert/strict';
import { parseAlinaBusinessUpdate } from './alina-business-update.ts';

const incoming = {
    update_id: 11,
    business_message: {
        message_id: 22,
        business_connection_id: 'business',
        chat: { id: 33, type: 'private' },
        from: { id: 33, username: 'buyer', first_name: 'Имя' },
        text: '  Есть места?  ',
    },
};
assert.deepEqual(parseAlinaBusinessUpdate(incoming), {
    chatId: 33, connectionId: 'business', updateId: 11, messageId: 22,
    kind: 'client', userId: 33, username: 'buyer', fullName: 'Имя',
    text: 'Есть места?', photoFileId: undefined,
});
assert.equal(parseAlinaBusinessUpdate({
    ...incoming,
    business_message: { ...incoming.business_message, from: { id: 44 } },
})?.kind, 'owner');
assert.equal(parseAlinaBusinessUpdate({
    ...incoming,
    business_message: { ...incoming.business_message, sender_business_bot: { id: 55 } },
}), null);
const photo = parseAlinaBusinessUpdate({
    ...incoming,
    business_message: { ...incoming.business_message, text: '', photo: [{ file_id: 'small' }, { file_id: 'large' }] },
});
assert.equal(photo?.kind === 'client' && photo.photoFileId, 'large');
assert.equal(parseAlinaBusinessUpdate({ update_id: 11 }), null);
assert.equal(parseAlinaBusinessUpdate({ ...incoming, update_id: undefined }), null);

console.log('alina-business-update: ok');
