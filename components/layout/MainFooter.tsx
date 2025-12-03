import Link from 'next/link';

export function MainFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Before Publishing</h3>
            <p className="text-gray-600 mb-4">
              Professional AI editing with editorial oversight.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-600 hover:text-blue-600">Editor</Link></li>
              <li><Link href="/portfolio" className="text-gray-600 hover:text-blue-600">Portfolio</Link></li>
              <li><Link href="/blog" className="text-gray-600 hover:text-blue-600">Blog</Link></li>
              <li><Link href="/write" className="text-gray-600 hover:text-blue-600">Write</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Support</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600 hover:text-blue-600">Help Center</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600">Contact Us</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Connect</h4>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-600 hover:text-blue-600">Twitter</a>
              <a href="#" className="text-gray-600 hover:text-blue-600">LinkedIn</a>
              <a href="#" className="text-gray-600 hover:text-blue-600">GitHub</a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-gray-500">
          © {new Date().getFullYear()} Before Publishing. All rights reserved.
        </div>
      </div>
    </footer>
  );
}