import { redirect } from 'next/navigation';

export default function Home() {
  // Make the AI page the site homepage
  redirect('/ai');
}