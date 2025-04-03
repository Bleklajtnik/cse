import { createFileRoute } from '@tanstack/react-router';
import HeroImage from '../../public/cse-hero.jpg';
export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <>
      <header className="h-[70vh] relative">
        <div className="absolute top-0 left-0 w-full h-full bg-black opacity-50"></div>
        <div className="h-[70vh]" style={{ backgroundImage: `url(${HeroImage})` }}></div>
        <h1 className="absolute top-1/2 left-1/2 text-white text-3xl transform -translate-x-1/2 -translate-y-1/2 width-full">
          Nauka angielskiego z pasją i doświadczeniem – Cambridge School
        </h1>
      </header>
      <section className="flex justify-around mt-8">
        <div className="flex flex-col items-center">
          <h4 className="text-7xl">
            30<span className="text-blue-600">+</span>
          </h4>
          <p className="mt-1 text-xl">lat doświadczenia</p>
        </div>
        <div className="flex flex-col items-center">
          <h4 className="text-7xl">
            10<span className="text-blue-600">+</span>
          </h4>
          <p className="mt-1 text-xl">firm nam zaufało</p>
        </div>
        <div className="flex flex-col items-center">
          <h4 className="text-7xl">
            10000<span className="text-blue-600">+</span>
          </h4>
          <p className="mt-1 text-xl">uczniów</p>
        </div>
      </section>
    </>
  );
}
