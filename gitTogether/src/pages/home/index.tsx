import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";

// https://github.com/vitejs/vite/issues/5145
export default function Home() {
  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <SidebarProvider>
        <AppSidebar className="bg-[hsl(222.2_84%_4.9%)] text-[hsl(210_40%_98%)] border-r border-[hsl(217.2_32.6%_17.5%)]" />
        
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-background border-b border-border">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      Building Your Application
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-row w-screen">
            <div className="border border-black h-full w-[50vw] m-[10px] p-[10px] rounded-md">
              <div className="flex flex-col">
                <h3 className="text-2xl font-bold text-center">Tasks</h3>
                <div className="flex flex-col p-[10px]">
                  <div className="border border-black h-full w-full mt-[10px] mb-[10px] p-[10px] rounded-md">
                    <a href="https://github.com/nodejs/node/issues/60249">Task 1</a>
                  </div>
                  <div className="border border-black h-full w-full mt-[10px] mb-[10px] p-[10px] rounded-md">
                    <a href="https://github.com/nodejs/node/issues/60247">Task 2</a>
                  </div>
                  <div className="border border-black h-full w-full mt-[10px] mb-[10px] p-[10px] rounded-md">
                    <a href="https://github.com/nodejs/node/issues/60242">Task 3</a>
                  </div>
                  <div className="border border-black h-full w-full mt-[10px] mb-[10px] p-[10px] rounded-md">
                    <a href="https://github.com/nodejs/node/issues/60240">Task 4</a>
                  </div>
                  <div className="border border-black h-full w-full mt-[10px] mb-[10px] p-[10px] rounded-md">
                    <a href="https://github.com/nodejs/node/issues/60239">Task 5</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-black h-full w-[50vw] m-[10px] p-[10px] rounded-md">
              <h3 className="text-2xl font-bold text-center">Section</h3>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
