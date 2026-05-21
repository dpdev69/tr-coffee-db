-- Populate roaster logo URLs from local copies of validated first-party icons.

UPDATE roasters AS r
SET logo_url = v.logo_url
FROM (
  VALUES
    ('aroasting-lab', '/roaster-logos/aroasting-lab.png'),
    ('a4-kahve', '/roaster-logos/a4-kahve.webp'),
    ('baristocrat', '/roaster-logos/baristocrat.png'),
    ('boxx', '/roaster-logos/boxx.png'),
    ('calibre', '/roaster-logos/calibre.webp'),
    ('coach-coffee', '/roaster-logos/coach-coffee.jpg'),
    ('coffee-department', '/roaster-logos/coffee-department.ico'),
    ('coffee-friendzone', '/roaster-logos/coffee-friendzone.png'),
    ('coffeemamma', '/roaster-logos/coffeemamma.png'),
    ('coffeenutz', '/roaster-logos/coffeenutz.png'),
    ('coffeerem', '/roaster-logos/coffeerem.png'),
    ('cup-of-joy', '/roaster-logos/cup-of-joy.png'),
    ('daphne', '/roaster-logos/daphne.png'),
    ('gourme', '/roaster-logos/gourme.jpg'),
    ('homestead', '/roaster-logos/homestead.png'),
    ('hound', '/roaster-logos/hound.webp'),
    ('kafeinkultur', '/roaster-logos/kafeinkultur.ico'),
    ('kernel', '/roaster-logos/kernel.webp'),
    ('kimma', '/roaster-logos/kimma.png'),
    ('kronotrop', '/roaster-logos/kronotrop.png'),
    ('molecule', '/roaster-logos/molecule.jpg'),
    ('montag', '/roaster-logos/montag.png'),
    ('nok-coffee', '/roaster-logos/nok-coffee.png'),
    ('null-coffee', '/roaster-logos/null-coffee.png'),
    ('old-java', '/roaster-logos/old-java.jpg'),
    ('ordinarius', '/roaster-logos/ordinarius.png'),
    ('orkun-ustel', '/roaster-logos/orkun-ustel.png'),
    ('paper', '/roaster-logos/paper.webp'),
    ('parsa', '/roaster-logos/parsa.png'),
    ('petra', '/roaster-logos/petra.jpg'),
    ('poka', '/roaster-logos/poka.png'),
    ('probador', '/roaster-logos/probador.png'),
    ('sezy', '/roaster-logos/sezy.png'),
    ('spada', '/roaster-logos/spada.webp'),
    ('story', '/roaster-logos/story.webp'),
    ('tetra-n', '/roaster-logos/tetra-n.webp')
) AS v(slug, logo_url)
WHERE r.slug = v.slug;
