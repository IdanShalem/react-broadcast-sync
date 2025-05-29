# React Broadcast Sync Demo

A showcase application demonstrating the capabilities of `react-broadcast-sync` - a library for synchronizing state across browser tabs.

## 🚀 Live Demo

Check out the [live demo](https://react-broadcast-sync.vercel.app) to see the synchronization in action!

## 🎯 Features

The demo showcases three main features:

1. **Counter Synchronization**

   - Real-time counter updates across tabs
   - Visual feedback for sync status
   - Smooth animations

2. **Text Synchronization**

   - Real-time text input sync
   - Multi-line support
   - Instant updates

3. **Todo List**
   - Synchronized todo items
   - Real-time hover effects
   - Scroll position sync
   - Completion status sync
   - Delete functionality

## 🛠️ Technologies Used

- React 19
- TypeScript
- Material-UI
- Framer Motion
- Vite

## 🚀 Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/IdanShalem/react-broadcast-sync.git
   cd react-broadcast-sync/demo/react-broadcast-sync-demo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open multiple browser tabs to see the synchronization in action!

## 📁 Project Structure

```
src/
├── components/
│   ├── Counter.tsx
│   ├── TextSync.tsx
│   └── TodoList.tsx
├── hooks/
│   ├── useCounterBroadcast.ts
│   ├── useTextBroadcast.ts
│   └── useTodoBroadcast.ts
├── App.tsx
├── main.tsx
└── theme.ts
```

## 💡 Implementation Details

### Counter Synchronization

```typescript
const { messages, postMessage } = useBroadcastChannel('counter', {
  keepLatestMessage: true,
  namespace: 'demo-app',
});
```

### Text Synchronization

```typescript
const { messages, postMessage } = useBroadcastChannel('text', {
  keepLatestMessage: true,
  namespace: 'demo-app',
});
```

### Todo List Synchronization

```typescript
const { messages, postMessage } = useBroadcastChannel('todos', {
  keepLatestMessage: true,
  namespace: 'demo-app',
});
```

## 🎨 UI/UX Features

- Responsive design
- Smooth animations
- Visual feedback for sync status
- Modern Material-UI components
- Dark mode support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 👥 Author

Idan Shalem

- GitHub: [@IdanShalem](https://github.com/IdanShalem)
- LinkedIn: [Idan Shalem](https://www.linkedin.com/in/idan-shalem-3a1781169/)
