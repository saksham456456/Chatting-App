const socket = io();

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        // We will send an object with text and socket id so we can identify self-messages
        const messageData = {
            text: input.value,
            senderId: socket.id
        };
        socket.emit('chat message', messageData);
        input.value = '';
    }
});

socket.on('chat message', (msg) => {
    const item = document.createElement('li');
    item.textContent = msg.text;
    
    // If the message is from our own socket id, add the 'self' class to style it differently
    if (msg.senderId === socket.id) {
        item.classList.add('self');
    }
    
    messages.appendChild(item);
    // Scroll to the bottom
    messages.scrollTop = messages.scrollHeight;
});
