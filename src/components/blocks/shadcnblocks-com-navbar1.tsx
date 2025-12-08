import { Book, Menu, Sunset, Trees, Zap } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { cn } from "../../lib/utils";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface Navbar1Props {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
    tagline?: string;
  };
  menu?: MenuItem[];
  mobileExtraLinks?: {
    name: string;
    url: string;
  }[];
  auth?: {
    login: {
      text: string;
      url: string;
    };
    signup: {
      text: string;
      url: string;
    };
  };
  className?: string;
  containerClassName?: string;
}

const Navbar1 = ({
  logo = {
    url: "/",
    src: "",
    alt: "logo",
    title: "Selma+",
    tagline: "Much more than just a booking system.",
  },
  menu = [
    { title: "Home", url: "#" },
    {
      title: "Products",
      url: "#",
      items: [
        {
          title: "Blog",
          description: "The latest industry news, updates, and info",
          icon: <Book className="size-5 shrink-0" />,
          url: "#",
        },
      ],
    },
  ],
  mobileExtraLinks = [],
  auth = {
    login: { text: "Log in", url: "#" },
    signup: { text: "Sign up", url: "#" },
  },
  className,
  containerClassName,
}: Navbar1Props) => {
  return (
    <section className={cn("py-0 w-full", className)}>
      <div className={cn("w-full", containerClassName)}>
        <nav className="hidden justify-between lg:flex w-full">
          <div className="flex items-center gap-6">
            <a href={logo.url} className="flex items-center gap-3">
              {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold text-white">{logo.title}</span>
                {logo.tagline && (
                  <span className="text-xs font-medium text-white/80 whitespace-nowrap">
                    {logo.tagline}
                  </span>
                )}
              </div>
            </a>
            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {menu.map((item) => renderMenuItem(item))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="navbar-cta-outline">
              {auth.login.url.startsWith("/") ? (
                <RouterLink to={auth.login.url}>{auth.login.text}</RouterLink>
              ) : (
                <a href={auth.login.url}>{auth.login.text}</a>
              )}
            </Button>
            <Button asChild size="sm" className="navbar-cta-btn">
              {auth.signup.url.startsWith("/") ? (
                <RouterLink to={auth.signup.url}>{auth.signup.text}</RouterLink>
              ) : (
                <a href={auth.signup.url}>{auth.signup.text}</a>
              )}
            </Button>
          </div>
        </nav>
        <div className="block lg:hidden w-full">
          <div className="flex items-center justify-between w-full">
            <a href={logo.url} className="flex items-center gap-3">
              {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-semibold text-white">{logo.title}</span>
                {logo.tagline && (
                  <span className="text-xs font-medium text-white/80 whitespace-nowrap">
                    {logo.tagline}
                  </span>
                )}
              </div>
            </a>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>
                    <a href={logo.url} className="flex items-center gap-2">
                      {logo.src ? <img src={logo.src} className="w-8" alt={logo.alt} /> : null}
                      <span className="text-lg font-semibold">
                        {logo.title}
                      </span>
                    </a>
                  </SheetTitle>
                </SheetHeader>
                <div className="my-6 flex flex-col gap-6">
                  <Accordion
                    type="single"
                    collapsible
                    className="flex w-full flex-col gap-4"
                  >
                    {menu.map((item) => renderMobileMenuItem(item))}
                  </Accordion>
                  {mobileExtraLinks.length > 0 && (
                    <div className="border-t py-4">
                      <div className="grid grid-cols-2 justify-start">
                        {mobileExtraLinks.map((link, idx) => (
                          <a
                            key={idx}
                            className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-accent-foreground"
                            href={link.url}
                          >
                            {link.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <Button asChild variant="outline" className="navbar-cta-outline">
                      {auth.login.url.startsWith("/") ? (
                        <RouterLink to={auth.login.url}>{auth.login.text}</RouterLink>
                      ) : (
                        <a href={auth.login.url}>{auth.login.text}</a>
                      )}
                    </Button>
                    <Button asChild className="navbar-cta-btn">
                      {auth.signup.url.startsWith("/") ? (
                        <RouterLink to={auth.signup.url}>{auth.signup.text}</RouterLink>
                      ) : (
                        <a href={auth.signup.url}>{auth.signup.text}</a>
                      )}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );
};

const renderMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <NavigationMenuItem key={item.title} className="text-white">
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="w-80 p-3 bg-background text-foreground">
            <NavigationMenuLink>
              {item.items.map((subItem) => (
                <li key={subItem.title}>
                  <a
                    className="flex select-none gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
                    href={subItem.url}
                  >
                    {subItem.icon}
                    <div>
                      <div className="text-sm font-semibold">
                        {subItem.title}
                      </div>
                      {subItem.description && (
                        <p className="text-sm leading-snug text-muted-foreground">
                          {subItem.description}
                        </p>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </NavigationMenuLink>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={item.title}>
      <a
        className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:text-white"
        href={item.url}
      >
        {item.title}
      </a>
    </NavigationMenuItem>
  );
};

const renderMobileMenuItem = (item: MenuItem) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="py-0 font-semibold hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map((subItem) => (
            <a
              key={subItem.title}
              className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-muted hover:text-accent-foreground"
              href={subItem.url}
            >
              {subItem.icon}
              <div>
                <div className="text-sm font-semibold">{subItem.title}</div>
                {subItem.description && (
                  <p className="text-sm leading-snug text-muted-foreground">
                    {subItem.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <AccordionItem key={item.title} value={item.title} className="border-b-0">
      <AccordionTrigger className="py-0 font-semibold hover:no-underline">
        {item.title}
      </AccordionTrigger>
    </AccordionItem>
  );
};

export { Navbar1 };
