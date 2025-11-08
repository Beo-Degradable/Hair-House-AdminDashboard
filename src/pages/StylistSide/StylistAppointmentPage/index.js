// Re-export the AppointmentPage component so imports that reference
// the folder (e.g. './pages/StylistSide/AppointmentPage') still resolve.
// This is a tiny compatibility barrel; we can remove it later once
// all imports use the explicit file path.
export { default } from './StylistAppointmentPage';
