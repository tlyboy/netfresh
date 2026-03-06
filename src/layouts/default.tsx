import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

function Default({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="netfresh-theme">
      <div className="flex h-full flex-col">{children}</div>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  )
}

export default Default
