import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MentalGameSection from "@/components/MentalGameSection";

const Workshops = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Workshops | Suffolk Tennis";
  }, []);

  return (
    <>
      <Navbar />
      <main className="pt-32">
        <MentalGameSection />
      </main>
      <Footer />
    </>
  );
};

export default Workshops;
