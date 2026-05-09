import os
import sys
import re

def generate_icons(output_dir=None, bg_color=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    svg_path = os.path.join(root_dir, "projects/extension/assets/icon.svg")
    output_dir = os.path.abspath(output_dir) if output_dir else os.path.join(root_dir, "projects/extension/icons")

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found.")
        return False

    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read()

    if bg_color:
        svg_content = re.sub(r'fill=["\'][^"\']+["\']', f'fill="{bg_color}"', svg_content, count=1)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: playwright not found.")
        return False

    if not os.path.exists(output_dir): os.makedirs(output_dir)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()

        for size in [16, 32, 48, 128]:
            page.set_viewport_size({"width": size, "height": size})

            # Embed SVG in a way that it scales perfectly to the viewport
            # We remove fixed width/height from the SVG tag if they exist and replace with 100%
            formatted_svg = re.sub(r'<svg[^>]*', lambda m: re.sub(r'\s+(width|height)=["\'][^"\']+["\']', '', m.group(0)), svg_content)
            formatted_svg = formatted_svg.replace('<svg', '<svg width="100%" height="100%"')

            html_content = f"""
            <!DOCTYPE html>
            <html style="margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;">
            <body style="margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent;">
                {formatted_svg}
            </body>
            </html>
            """
            page.set_content(html_content)
            page.wait_for_timeout(200)

            out = os.path.join(output_dir, f"icon{size}.png")
            page.screenshot(path=out, omit_background=True)
            print(f"Generated {out}")
        browser.close()
    return True

if __name__ == "__main__":
    if not generate_icons(sys.argv[1] if len(sys.argv) > 1 else None, sys.argv[2] if len(sys.argv) > 2 else None):
        sys.exit(1)
