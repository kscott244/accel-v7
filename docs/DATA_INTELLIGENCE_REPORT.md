====================================================================================================
ACCEL-V7 — DATA INTELLIGENCE REPORT
Generated: March 27, 2026
====================================================================================================


================================================================================
SECTION 1: MATCHING SIGNALS DISCOVERED
================================================================================

Signal 1: PARENT CM — Kerr/Tableau assigns accounts under parent CM numbers. This is the baseline.
  - Large DSOs (Aspen, Smile Doctors, Heartland) have most acquisitions correctly parented
  - Mid-size DSOs (Plum, Resolute) have many acquisitions still under original practice CMs

Signal 2: NORMALIZED ADDRESS — same physical address = same office or same building
  - Strip suite/unit numbers for broader matching
  - Two accounts at same address + different parent CMs = dealer split or acquisition

Signal 3: ANCHOR-ORPHAN — a known multi-location group (3+ locs) at same address as a standalone (1-2 locs)
  - The big group is the "anchor" — it's a known org
  - The standalone is the "orphan" — it's probably the same office buying through a different dealer
  - Or it's a practice in the same building (false positive) — filter by dental-only to reduce noise
  - FOUND: 137 orphan accounts linked to 32 anchor groups

Signal 4: DOCTOR NAME IN ADDRESS FIELD — Kerr embeds managing doctor name after the street address
  - Example: "141 Hebron Ave Ste 3 Dr. Michael Capalbo" — Capalbo is the Plum Dental owner
  - Useful for linking DSO-managed practices back to their parent org
  - High noise ratio — needs full last name + first name matching, not partial

Signal 5: EMAIL DOMAIN — org-specific email domain shared across different CMs = confirmed same org
  - @allaboutkidsteeth.com links 2 All About Kids accounts (Abra Dental subsidiary)
  - @scarsdaleoralsurgery.com links Breiman + Langsam across different parents
  - Only 358 accounts have emails in current data — weak signal overall
  - Would be much stronger with more email coverage

Signal 6: EXTERNAL TRUTH FILES — authoritative org membership lists
  - Group_Account.csv: 74 DSO/multi-practice groups, 258 children — 100% accurate
  - Plum Dental xlsx: 44 offices — mapped to 16 different Kerr parent groups
  - Gold/Silver Accelerate csv: 14 groups, 69 children — revealed 24 Advanced Dental Brands locations missing from preloaded

Signal 7: CLASS2 = DSO on single-location accounts
  - 29 accounts labeled DSO but only 1 child — these are acquired practices
  - Parent org unknown from Kerr data alone — need external signals to determine who acquired them



================================================================================
SECTION 2: KEY PATTERN — HOW KERR DATA REPRESENTS DSO ACQUISITIONS
================================================================================

When a DSO acquires a practice:
  1. Large DSOs (Aspen, Heartland, Smile Doctors, Dental 365): Kerr re-parents the acquired
     practice under the DSO's parent CM. The child keeps its original practice name.
     Example: "CT BRACES" is a child of Smile Doctors (Master-CM1064374).
     All children share the DSO's tier and class2=DSO.
     → These are CORRECTLY grouped in preloaded data. No fix needed.

  2. Mid-size DSOs (Plum, Resolute, Edge Dental): Kerr creates a SECOND parent CM for the
     acquisition but leaves the original practice under its old parent CM too.
     Example: Plum Dental has 3 parent CMs (Master-CM94845, CM17673266, CM1302473).
     Some locations are under Plum's CMs, others are still standalone.
     → Need overlay merges or truth files to consolidate.

  3. Small/Emerging DSOs: Kerr may not update anything. The practice keeps its original CM
     and gets class2=DSO as the only signal. No link to the acquiring DSO.
     → Need external data (truth files, email, address matching) to discover.

The doctor name in the address field is a Kerr pattern for DSO-managed practices.
  "172 Division St Shyam G Desai" = the address has the managing doctor's name appended.
  This links back to the parent org when cross-referenced against child names in other groups.



================================================================================
SECTION 3: ANCHOR-ORPHAN DISCOVERIES (137 total)
================================================================================
  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: KEVIN M. STANTON, D.M.D. (Master-CM277163) | currently: KEVIN M. STANTON, D.M.D.: Master-CM277163
  ADDRESS: 120 Park Lane Rd Unit B202, New Milford 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: CT FAMILY DENTISTRY (Master-CM172008) | currently: CT FAMILY DENTISTRY: Master-CM172008
  ADDRESS: 945 Main St Ste 101, Manchester 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: CARE DENTAL CENTER- MERCH (Master-CM222068) | currently: CARE DENTAL CENTER- MERCH: Master-CM222068
  ADDRESS: 191 Franklin Ave, Hartford 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: KATE KIGURADZE (Master-CM225946) | currently: KATE KIGURADZE: Master-CM225946
  ADDRESS: 106 Noroton Ave Ste #103, Darien 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: KETEVAN KIGURADZE DDS (Master-CM915216) | currently: KETEVAN KIGURADZE DDS: Master-CM915216
  ADDRESS: 106 Noroton Ave Ste 103, Darien 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: MARC CRAIG DMD (Master-CM9817324) | currently: MARC CRAIG DMD: Master-CM9817324
  ADDRESS: 1090 Meriden Waterbury Tpke Suite 3, Cheshire 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: R & A ASSOCIATES OF CHESHIRE LLC (Master-CM888988) | currently: R & A ASSOCIATES OF CHESHIRE LLC: Master-CM888988
  ADDRESS: 1090 Meriden Waterbury Tpke, Cheshire 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: ROBERT KANIA (Master-CM221607) | currently: ROBERT KANIA: Master-CM221607
  ADDRESS: 35 Pearl St, New Britain 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: NEW BRITAIN DENTAL ARTS LLC (Master-CM1054921) | currently: NEW BRITAIN DENTAL ARTS LLC: Master-CM1054921
  ADDRESS: 35 Pearl St Ste 204, New Britain 

  ANCHOR: DENTAL ASSOCIATES OF CONNECTICUT (Master-CM1191419) — 33 locs
  ORPHAN: NEUROLOGIC ASSOCIATES (Master-CM1335086) | currently: NEUROLOGIC ASSOCIATES: Master-CM1335086
  ADDRESS: 35 Pearl St Ste 201, New Britain 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: RICHARD L SCHECHTMAN DDS (Master-CM056306) | currently: RICHARD L SCHECHTMAN DDS: Master-CM056306
  ADDRESS: 3630 Hill Blvd Ste 405, Jefferson Valley 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: ROBERT CROSS DDS (Master-CM265107) | currently: ROBERT CROSS DDS: Master-CM265107
  ADDRESS: 3630 Hill Blvd Ste 302, Jefferson Valley 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: SANDRA KELLETT (Master-CM1807376) | currently: SANDRA KELLETT: Master-CM1807376
  ADDRESS: 3630 Hill Blvd Ste 303, Jefferson Valley 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: 12 MONTH SMILES (Master-CM953708) | currently: 12 MONTH SMILES: Master-CM953708
  ADDRESS: 300 Hemingway Ave, East Haven 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: 12 MONTH SMILES (Master-CM1998037) | currently: 12 MONTH SMILES: Master-CM1998037
  ADDRESS: 300 Hemingway Ave, East Haven 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: COMPREHENSIVE DENTAL GROUP (Master-CM051914) | currently: COMPREHENSIVE DENTAL GROUP: Master-CM051914
  ADDRESS: 999 Summer St Ste 400, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: STAMFORD ORTHODONTICS (Master-CM120991) | currently: STAMFORD ORTHODONTICS: Master-CM120991
  ADDRESS: 999 Summer St Ste 201, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: PETER A. GARDELL DDS (Master-CM095424) | currently: PETER A. GARDELL DDS: Master-CM095424
  ADDRESS: 999 Summer St Ste 203, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: OFC OF BRAD ERIK SHWIDOCK DMD (Master-CM230487) | currently: OFC OF BRAD ERIK SHWIDOCK DMD: Master-CM230487
  ADDRESS: 999 Summer St Ste 306, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: CARLESI, VINCENT R (Master-CM1344810) | currently: CARLESI, VINCENT R: Master-CM1344810
  ADDRESS: 999 Summer St Ste 304, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: FAIRFIELD ENDODONTICS (Master-CM144910) | currently: FAIRFIELD ENDODONTICS: Master-CM144910
  ADDRESS: 999 Summer St Ste 301, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: MATTHEW LOPRESTI (Master-CM1903005) | currently: MATTHEW LOPRESTI: Master-CM1903005
  ADDRESS: 75 Tresser Blvd Unit 467, Stamford 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: JAMES BRANCO DDS (Master-CM125728) | currently: JAMES BRANCO DDS: Master-CM125728
  ADDRESS: 1075 Central Park Ave, Scarsdale 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: DENTAL IMPLANTS DYNAMICS  P.C. (Master-CM063556) | currently: DENTAL IMPLANTS DYNAMICS  P.C.: Master-CM063556
  ADDRESS: 1075 Central Park Ave Ste 410, Scarsdale 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: JEFF SUH DDS (Master-CM1100934) | currently: JEFF SUH DDS: Master-CM1100934
  ADDRESS: 1075 Central Park Ave Ste 200, Scarsdale 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: MARIGOLD DENTAL STUDIO (Master-CM17702768) | currently: MARIGOLD DENTAL STUDIO: Master-CM17702768
  ADDRESS: 727 East Ave, Pawtucket 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: JEFFREY O'CONNELL (Master-CM17748711) | currently: JEFFREY O'CONNELL: Master-CM17748711
  ADDRESS: 115 Technology Dr Unit B106, Trumbull 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: SALVATORE FLORIO, D.D.S. (Master-CM1169609) | currently: SALVATORE FLORIO, D.D.S.: Master-CM1169609
  ADDRESS: 115 Technology Dr Suite B-101, Trumbull 

  ANCHOR: DENTAL WHALE: Master-CM1486131 (Master-CM1486131) — 47 locs
  ORPHAN: ASSOCIATES IN ENDODONTICS (Master-CM122405) | currently: ASSOCIATES IN ENDODONTICS: Master-CM122405
  ADDRESS: 928 Farmington Ave, West Hartford 

  ANCHOR: DENTAL 365: Master-CM1873360 (Master-CM1873360) — 23 locs
  ORPHAN: RONALD CWIK (Master-CM1311698) | currently: RONALD CWIK: Master-CM1311698
  ADDRESS: 652 Boston Post Rd Ste 4, Guilford 

  ANCHOR: DENTAL 365: Master-CM1873360 (Master-CM1873360) — 23 locs
  ORPHAN: WIND,DDS, ROBERT (Master-CM461321) | currently: WIND,DDS, ROBERT: Master-CM461321
  ADDRESS: 222 Route 59 Ste 209, Suffern 

  ANCHOR: DENTAL 365: Master-CM1873360 (Master-CM1873360) — 23 locs
  ORPHAN: AESTHETICS DENTAL ASSOCIATES (Master-CM126047) | currently: AESTHETICS DENTAL ASSOCIATES: Master-CM126047
  ADDRESS: 222 Westchester Ave, West Harrison 

  ANCHOR: DENTAL 365: Master-CM1873360 (Master-CM1873360) — 23 locs
  ORPHAN: CAROLYN CLEMENZA, DDS (Master-CM307860) | currently: CAROLYN CLEMENZA, DDS: Master-CM307860
  ADDRESS: 359 E Main St Ste 2e, Mount Kisco 

  ANCHOR: DENTAL 365: Master-CM1873360 (Master-CM1873360) — 23 locs
  ORPHAN: BANK, DAVID E (Master-CM1203920) | currently: BANK, DAVID E: Master-CM1203920
  ADDRESS: 359 E Main St Ste 4g/E, Mount Kisco 

  ANCHOR: 42 NORTH: Master-CM074737 (Master-CM074737) — 32 locs
  ORPHAN: FERDA HATIBOGLU (Master-CM252626) | currently: FERDA HATIBOGLU: Master-CM252626
  ADDRESS: 295 Washington Ave, Hamden 

  ANCHOR: 42 NORTH: Master-CM074737 (Master-CM074737) — 32 locs
  ORPHAN: CAMP SAMBOR & ASSOCIATES (Master-CM225917) | currently: CAMP SAMBOR & ASSOCIATES: Master-CM225917
  ADDRESS: 35 Pleasant St Ste 2b, Meriden 

  ANCHOR: 42 NORTH: Master-CM074737 (Master-CM074737) — 32 locs
  ORPHAN: OFC OF MICHAEL A BROWN DDS (Master-CM189706) | currently: OFC OF MICHAEL A BROWN DDS: Master-CM189706
  ADDRESS: 333 Kennedy Dr, Torrington 

  ANCHOR: ABRA DENTAL: Master-CM175757 (Master-CM175757) — 4 locs
  ORPHAN: ALL ABOUT KIDS PED DTSTRY (Master-CM704467) | currently: ALL ABOUT KIDS PED DTSTRY: Master-CM704467
  ADDRESS: 47 West St Ste 203, Danbury 

  ANCHOR: ABRA DENTAL: Master-CM175757 (Master-CM175757) — 4 locs
  ORPHAN: ALL ABOUT KIDS (Master-CM721414) | currently: ALL ABOUT KIDS: Master-CM721414
  ADDRESS: 47 West St Ste 2, Danbury 

  ANCHOR: ABRA DENTAL: Master-CM175757 (Master-CM175757) — 4 locs
  ORPHAN: ALL ABOUT KIDS - PEDO - STAMFORD (Master-CM9814079) | currently: ALL ABOUT KIDS - PEDO - STAMFORD: Master-CM9814079
  ADDRESS: 127 Greyrock Pl Unit C1, Stamford 

  ANCHOR: ABRA DENTAL: Master-CM175757 (Master-CM175757) — 4 locs
  ORPHAN: ALL ABOUT KIDS PEDIATRIC DENTISTRY (Master-CM17672868) | currently: ALL ABOUT KIDS PEDIATRIC DENTISTRY: Master-CM17672868
  ADDRESS: 127 Greyrock Pl, Stamford 

  ANCHOR: ABRA DENTAL: Master-CM175757 (Master-CM175757) — 4 locs
  ORPHAN: ORTHODONTICS - AAK - STAMFORD (Master-CM2044676) | currently: ORTHODONTICS - AAK - STAMFORD: Master-CM2044676
  ADDRESS: 127 Greyrock Pl Unit C2, Stamford 

  ANCHOR: HEARTLAND DENTAL CARE: Master-CM055546 (Master-CM055546) — 12 locs
  ORPHAN: ORAL & MAXILLOFACIAL SURGEONS PC (Master-CM221536) | currently: ORAL & MAXILLOFACIAL SURGEONS PC: Master-CM221536
  ADDRESS: 131 New London Tpke Ste 106, Glastonbury 

  ANCHOR: HEARTLAND DENTAL CARE: Master-CM055546 (Master-CM055546) — 12 locs
  ORPHAN: ROBERT S EMILIO DDS LLC (Master-CM075109) | currently: ROBERT S EMILIO DDS LLC: Master-CM075109
  ADDRESS: 111 East Ave Ste 214, Norwalk 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: CENTER DENTAL (Master-CM132736) | currently: CENTER DENTAL: Master-CM132736
  ADDRESS: 836 Farmington Ave Ste 120, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: WEST HARTFORD DENTAL PC (Master-CM141858) | currently: WEST HARTFORD DENTAL PC: Master-CM141858
  ADDRESS: Ste 217a 836 Farmington Ave, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: CENTRAL CT OM & IMPLANT (Master-CM656183) | currently: CENTRAL CT OM & IMPLANT: Master-CM656183
  ADDRESS: 836 Farmington Ave Ste 223, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: JOEL GOODMAN (Master-CM130501) | currently: JOEL GOODMAN: Master-CM130501
  ADDRESS: 836 Farmington Ave Ste 225, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: LANA SKAKUN DMD (Master-CM174761) | currently: LANA SKAKUN DMD: Master-CM174761
  ADDRESS: 836 Farmington Ave Suite 129, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: CENTRAL CONNECTICUT ENDODONTICS PC (Master-CM048918) | currently: CENTRAL CONNECTICUT ENDODONTICS PC: Master-CM048918
  ADDRESS: 836 Farmington Ave Ste 115, West Hartford 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: JOSEPH VIANA (Master-CM173648) | currently: JOSEPH VIANA: Master-CM173648
  ADDRESS: 970 N Broadway Ste 211, Yonkers 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: DRS. FRANK AND JOHN CASTANARO (Master-CM202791) | currently: DRS. FRANK AND JOHN CASTANARO: Master-CM202791
  ADDRESS: 970 N Broadway Ste 304, Yonkers 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: LARRY M GENSER DDS (Master-CM143669) | currently: LARRY M GENSER DDS: Master-CM143669
  ADDRESS: 970 N Broadway Ste 301, Yonkers 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: MARY ANN PIETROPAOLO DMD (Master-CM236764) | currently: MARY ANN PIETROPAOLO DMD: Master-CM236764
  ADDRESS: 970 N Broadway Ste 305a, Yonkers 

  ANCHOR: DENTAL CARE ALLIANCE: Master-CM354571 (Master-CM354571) — 22 locs
  ORPHAN: RICHARD AMATO (Master-CM074587) | currently: RICHARD AMATO: Master-CM074587
  ADDRESS: 324 Elm St Ste 103a, Monroe 

  ANCHOR: SMILE BRANDS: Master-CM098299 (Master-CM098299) — 33 locs
  ORPHAN: ENT & ALLERGY ASSOC. (Master-CM333918) | currently: ENT & ALLERGY ASSOC.: Master-CM333918
  ADDRESS: 3020 Westchester Ave, Purchase 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: DR. JARED S.PERCYZ D.D.S. (Master-CM866835) | currently: DR. JARED S.PERCYZ D.D.S.: Master-CM866835
  ADDRESS: 27 Meriden Ave, Southington 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: DR HOWARD LEVINBOOK (Master-CM1377742) | currently: DR HOWARD LEVINBOOK: Master-CM1377742
  ADDRESS: 27 Meriden Ave Suite 1b, Southington 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: CENTER FOR DENTAL EXCELLENCE (Master-CM17699391) | currently: CENTER FOR DENTAL EXCELLENCE: Master-CM17699391
  ADDRESS: 340 Bantam Rd, Litchfield 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: TUYEN NGUYEN (Master-CM115805) | currently: TUYEN NGUYEN: Master-CM115805
  ADDRESS: 477 Connecticut Blvd, East Hartford 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: RI ORTHODONTIC GROUP (Master-CM095984) | currently: RI ORTHODONTIC GROUP: Master-CM095984
  ADDRESS: 24 Salt Pond Rd Ste A3, Wakefield 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: DR DONNA HAGERTY (Master-CM329106) | currently: DR DONNA HAGERTY: Master-CM329106
  ADDRESS: 24 Salt Pond Rd Ste E3, Wakefield 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: BLAKE WINOKUR (Master-CM135319) | currently: BLAKE WINOKUR: Master-CM135319
  ADDRESS: 53 North St, Danbury 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: JENNIFER A BOYCE DMD (Master-CM131919) | currently: JENNIFER A BOYCE DMD: Master-CM131919
  ADDRESS: 53 North St Ste 3, Danbury 

  ANCHOR: SMILE DOCTORS: Master-CM1064374 (Master-CM1064374) — 21 locs
  ORPHAN: SD DANBURY - NORTH (Master-CM17785066) | currently: SD DANBURY - NORTH: Master-CM17785066
  ADDRESS: 53 North St Ste 4, Danbury 

  ANCHOR: COLUMBIA DENTAL: Master-CM048310 (Master-CM048310) — 26 locs
  ORPHAN: COLUMBIA DENTAL (Master-CM2045017) | currently: COLUMBIA DENTAL: Master-CM2045017
  ADDRESS: 1389 W Main St Ste 212, Waterbury 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: FARMINGTON VALLEY ORTHODONTIC ASSOCIATES (Master-CM89144) | currently: FARMINGTON VALLEY ORTHODONTIC ASSOCIATES: Master-CM89144
  ADDRESS: 20 W Avon Rd, Avon 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: THOMSEN FAMILY DENTISTRY (Master-CM119788) | currently: THOMSEN FAMILY DENTISTRY: Master-CM119788
  ADDRESS: 55 Town Line Rd Ste 202, Wethersfield 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: ROCKY HILL DENTAL ASSOCIATES (Master-CM186878) | currently: ROCKY HILL DENTAL ASSOCIATES: Master-CM186878
  ADDRESS: 55 Town Line Rd Ste 100, Wethersfield 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: CT PERIODONTAL SPECIALISTS, LLC (Master-CM129830) | currently: CT PERIODONTAL SPECIALISTS, LLC: Master-CM129830
  ADDRESS: 360 Tolland Tpke Ste 1-C, Manchester 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: RONALD J ALBERT DMD (Master-CM076593) | currently: RONALD J ALBERT DMD: Master-CM076593
  ADDRESS: 360 Tolland Tpke Ste 2b, Manchester 

  ANCHOR: AFFINITY DENTAL MANAGEMENT: Master-CM1618511 (Master-CM1618511) — 16 locs
  ORPHAN: ANDREW S BREIMAN AND ASSOCIATES (Master-CM071824) | currently: ANDREW S BREIMAN AND ASSOCIATES: Master-CM071824
  ADDRESS: 35 E Grassy Sprain Rd, Yonkers 

  ANCHOR: HASKINS, DR JEFFREY W: Master-CM1918118 (Master-CM1918118) — 9 locs
  ORPHAN: FORTIER LAWRENCE DR (Master-CM1676722) | currently: FORTIER LAWRENCE DR: Master-CM1676722
  ADDRESS: 465 Silas Deane Hwy, Wethersfield 

  ANCHOR: MB2: Master-CM169871 (Master-CM169871) — 8 locs
  ORPHAN: FELDMAN ORTHODONTICS (Master-CM179329) | currently: FELDMAN ORTHODONTICS: Master-CM179329
  ADDRESS: 435 Highland Ave Ste 200, Cheshire 

  ANCHOR: MB2: Master-CM169871 (Master-CM169871) — 8 locs
  ORPHAN: GREATER WATERBURY ORAL AND MAXILLOFACIAL SURGEONS (Master-CM701840) | currently: GREATER WATERBURY ORAL AND MAXILLOFACIAL SURGEONS: Master-CM701840
  ADDRESS: 435 Highland Ave, Cheshire 

  ANCHOR: THE SMILIST: Master-CM673640 (Master-CM673640) — 9 locs
  ORPHAN: THOMAS VALLUZZO DMD (Master-CM152428) | currently: THOMAS VALLUZZO DMD: Master-CM152428
  ADDRESS: 57 North St Ste 318, Danbury 

  ANCHOR: THE SMILIST: Master-CM673640 (Master-CM673640) — 9 locs
  ORPHAN: STEPHEN KOWALCZYK (Master-CM054796) | currently: STEPHEN KOWALCZYK: Master-CM054796
  ADDRESS: 57 North St, Danbury 

  ANCHOR: THE SMILIST: Master-CM673640 (Master-CM673640) — 9 locs
  ORPHAN: JOHN F BARTA DMD (Master-CM191344) | currently: JOHN F BARTA DMD: Master-CM191344
  ADDRESS: 57 North St, Danbury 

  ANCHOR: THE SMILIST: Master-CM673640 (Master-CM673640) — 9 locs
  ORPHAN: IVAN K WEINSTEIN DDS (Master-CM352218) | currently: IVAN K WEINSTEIN DDS: Master-CM352218
  ADDRESS: 57 North St Ste 122a, Danbury 

  ANCHOR: DOCTOR DENTAL: Master-CM128801 (Master-CM128801) — 18 locs
  ORPHAN: BRIGHT SMILES (Master-CM17758596) | currently: BRIGHT SMILES: Master-CM17758596
  ADDRESS: 18 Kane St, West Hartford 

  ANCHOR: PLUM DENTAL: Master-CM94845 (Master-CM94845) — 26 locs
  ORPHAN: ROCKY HILL DENTAL GROUP PLLC (Master-CM1237563) | currently: ROCKY HILL DENTAL GROUP PLLC: Master-CM1237563
  ADDRESS: 412 Cromwell Ave, Rocky Hill 

  ANCHOR: PLUM DENTAL: Master-CM94845 (Master-CM94845) — 26 locs
  ORPHAN: RON CAPALBO (Master-CM385952) | currently: COUSINS,CONSTANCE DDS: Master-CM052034
  ADDRESS: 130 Granite St, Westerly 

  ANCHOR: PLUM DENTAL: Master-CM94845 (Master-CM94845) — 26 locs
  ORPHAN: DR ELLIOT H KIMMEL & ASSOCIATES PC (Master-CM230703) | currently: DR ELLIOT H KIMMEL & ASSOCIATES PC: Master-CM230703
  ADDRESS: 27 Broad St, New London 

  ANCHOR: PLUM DENTAL: Master-CM94845 (Master-CM94845) — 26 locs
  ORPHAN: ASCHAFFENBURG & ENGLISH (Master-CM061279) | currently: ASCHAFFENBURG & ENGLISH: Master-CM061279
  ADDRESS: 222 Jefferson Blvd Ste 301, Warwick 

  ANCHOR: COUNTY DENTAL GROUP: Master-CM198796 (Master-CM198796) — 4 locs
  ORPHAN: CENTER FOR HOLISTIC DENTISTRY (Master-CM077364) | currently: CENTER FOR HOLISTIC DENTISTRY: Master-CM077364
  ADDRESS: 2649 Strang Blvd Ste 201, Yorktown Heights 

  ANCHOR: SMILE SOURCE: Master-CM701326 (Master-CM701326) — 9 locs
  ORPHAN: USE 609993 DR ROBERT A KIEL (Master-CM888724) | currently: USE 609993 DR ROBERT A KIEL: Master-CM888724
  ADDRESS: 281 Hartford Tpke, Vernon 

  ANCHOR: SMILE SOURCE: Master-CM701326 (Master-CM701326) — 9 locs
  ORPHAN: BABAR R KHAN DMD (Master-CM17713661) | currently: BABAR R KHAN DMD: Master-CM17713661
  ADDRESS: 281 Hartford Tpke Ste 210, Vernon 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: CAPE COD PERIO (Master-CM17720541) | currently: CAPE COD PERIO: Master-CM17720541
  ADDRESS: 244 Willow St Ste 1 Dr Joe Nguyen, Yarmouth Port 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: KEVIN MICHAEL KENNEDY DDS (Master-CM086717) | currently: KEVIN MICHAEL KENNEDY DDS: Master-CM086717
  ADDRESS: 3193 Main St, Bridgeport 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: JOONG S LEE DDS (Master-CM075425) | currently: JOONG S LEE DDS: Master-CM075425
  ADDRESS: Ste 3-H 123 York St, New Haven 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: USE 44882 ALAN FRIEDLER (Master-CM859041) | currently: NEW HAVEN ORAL MAXILLOFACIAL SURGERY: Master-CM234359
  ADDRESS: 123 York St Ste 1a, New Haven 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: DAVID J. WOHL, DDS (Master-CM261267) | currently: DAVID J. WOHL, DDS: Master-CM261267
  ADDRESS: 111 Beach Rd 1st Floor, Fairfield 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: THUNDERMIST HEALTH ASSOC INC (Master-CM1086508) | currently: THUNDERMIST HEALTH ASSOC INC: Master-CM1086508
  ADDRESS: 4th Fl 25 John A Cummings Way, Woonsocket 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: HARRIS  HARNICK (Master-CM286923) | currently: HARRIS  HARNICK: Master-CM286923
  ADDRESS: 4th Fl 25 John A Cummings Way, Woonsocket 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: BARNETT & SHOFLICK FAMILY DENTISTRY (Master-CM105155) | currently: BARNETT & SHOFLICK FAMILY DENTISTRY: Master-CM105155
  ADDRESS: 2139 Silas Deane Hwy Ste 102, Rocky Hill 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: SHOFLICK & MCCABE PLLC (Master-CM1374737) | currently: SHOFLICK & MCCABE PLLC: Master-CM1374737
  ADDRESS: 2139 Silas Deane Hwy Ste 206a, Rocky Hill 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: FUSCO FAMILY DENTISTRY (Master-CM185758) | currently: FUSCO FAMILY DENTISTRY: Master-CM185758
  ADDRESS: 2139 Silas Deane Hwy Ste 200, Rocky Hill 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: DRS MH CHANG AND YW CHANG DDS (Master-CM296382) | currently: DRS MH CHANG AND YW CHANG DDS: Master-CM296382
  ADDRESS: 30 E Hartsdale Ave Joeming Jamie Chan, Hartsdale 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: NEWINGTON FAMILY DENTISTRY (Master-CM375594) | currently: NEWINGTON FAMILY DENTISTRY: Master-CM375594
  ADDRESS: 365 Willard Ave Ste 2f, Newington 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: THEODORE J ADAMIDIS DMD (Master-CM866145) | currently: THEODORE J ADAMIDIS DMD: Master-CM866145
  ADDRESS: 365 Willard Ave, Newington 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: DR THEODORE ADAMIDIS (Master-CM1844704) | currently: DR THEODORE ADAMIDIS: Master-CM1844704
  ADDRESS: 365 Willard Ave Ste 2, Newington 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: KENNETH R. FINN DMD, LLC (Master-CM563585) | currently: KENNETH R. FINN DMD, LLC: Master-CM563585
  ADDRESS: 530 Hopmeadow St Ste 110, Simsbury 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: OFC OF MARK DANIEL POCHEBIT DDS (Master-CM180759) | currently: OFC OF MARK DANIEL POCHEBIT DDS: Master-CM180759
  ADDRESS: 151 Waterman St, Providence 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: PETER A PAYNE DMD (Master-CM123715) | currently: PETER A PAYNE DMD: Master-CM123715
  ADDRESS: 151 Waterman St, Providence 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: GRANDBY DENTAL CENTER (Master-CM1397093) | currently: GRANDBY DENTAL CENTER: Master-CM1397093
  ADDRESS: 41 Hartford Ave, Granby 

  ANCHOR: UNMATCHED ACCOUNT: Master-Unmatched (Master-Unmatched) — 27 locs
  ORPHAN: WILLIAM B CHAN DMD INC (Master-CM045913) | currently: NEXT LEVEL: Master-CM085819
  ADDRESS: 2359 Mendon Rd, Cumberland 

  ANCHOR: PROHEALTH DENTAL MANAGEMENT: Master-CM1281472 (Master-CM1281472) — 9 locs
  ORPHAN: NEW YORK EYE AND FACE (Master-CM2007062) | currently: NEW YORK EYE AND FACE: Master-CM2007062
  ADDRESS: 244 Westchester Ave Ste 111, White Plains 

  ANCHOR: ROBERT J KOLTS DDS: Master-CM1513664 (Master-CM1513664) — 8 locs
  ORPHAN: SAMUEL SCHUSTER DDS (Master-CM1908413) | currently: SAMUEL SCHUSTER DDS: Master-CM1908413
  ADDRESS: 11 Medical Park Dr Ste 106, Pomona 

  ANCHOR: ROBERT J KOLTS DDS: Master-CM1513664 (Master-CM1513664) — 8 locs
  ORPHAN: JONATHAN R TIGER (Master-CM948766) | currently: JONATHAN R TIGER: Master-CM948766
  ADDRESS: 11 Medical Park Dr Ste 202, Pomona 

  ANCHOR: ROBERT J KOLTS DDS: Master-CM1513664 (Master-CM1513664) — 8 locs
  ORPHAN: JONATHAN TIGER (Master-CM189754) | currently: JONATHAN TIGER: Master-CM189754
  ADDRESS: 11 Medical Park Dr Ste 202, Pomona 

  ANCHOR: ROBERT J KOLTS DDS: Master-CM1513664 (Master-CM1513664) — 8 locs
  ORPHAN: PARKVIEW FAMILY DENTAL, PC (Master-CM139615) | currently: PARKVIEW FAMILY DENTAL, PC: Master-CM139615
  ADDRESS: Suite 201 11 Medical Park Dr., Pomona 

  ANCHOR: ROBERT J KOLTS DDS: Master-CM1513664 (Master-CM1513664) — 8 locs
  ORPHAN: AESTHETIC PODIATRY AND SPORTS (Master-CM617770) | currently: AESTHETIC PODIATRY AND SPORTS: Master-CM617770
  ADDRESS: 10 Mitchell Pl Ste 105, White Plains 

  ANCHOR: SELECT DENTAL MANAGEMENT: Master-CM947226 (Master-CM947226) — 10 locs
  ORPHAN: COSMETIC AND GENERAL DENTISTRY (Master-CM141951) | currently: SELECT DENTAL MANAGEMENT: Master-CM1613697
  ADDRESS: 115 N Main St, New City 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: ADVANCED ENDODONTICS OF CT PC (Master-CM173275) | currently: ADVANCED ENDODONTICS OF CT PC: Master-CM173275
  ADDRESS: 546 S Broad St Ste 3b, Meriden 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: ADVANCED EYE PHYSICIANS (Master-CM270277) | currently: ADVANCED EYE PHYSICIANS: Master-CM270277
  ADDRESS: 546 S Broad St Ste 1d, Meriden 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: RICHARD L. KALMANS, DDS (Master-CM080714) | currently: RICHARD L. KALMANS, DDS: Master-CM080714
  ADDRESS: 90 Morgan St Ste 305, Stamford 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: JOSEPH SCIARRINO DDS (Master-CM080098) | currently: JOSEPH SCIARRINO DDS: Master-CM080098
  ADDRESS: 90 Morgan St Ste 308, Stamford 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: GORDON & MALTZ (Master-CM168854) | currently: END045 CUSTOM ENDODONTICS MINO: Master-CM1913436
  ADDRESS: 19 Squadron Blvd, New City 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: IRWIN STEVEN SCHIFF DDS (Master-CM910199) | currently: IRWIN STEVEN SCHIFF DDS: Master-CM910199
  ADDRESS: 22 Mulberry St, Middletown 

  ANCHOR: SPECIALTY 1 PARTNERS: Master-CM1836151 (Master-CM1836151) — 17 locs
  ORPHAN: JOHN THOMAS LYNCH DMD (Master-CM107677) | currently: JOHN THOMAS LYNCH DMD: Master-CM107677
  ADDRESS: 22 Mulberry St Ste 1b, Middletown 

  ANCHOR: ROLIGO DENTAL: Master-CM172041 (Master-CM172041) — 4 locs
  ORPHAN: CANTERINO DENTAL ASSOCIATES (Master-CM064815) | currently: YOUR SMILE GROUP: Master-CM161620
  ADDRESS: 984 N Broadway Ste 408, Yonkers 

  ANCHOR: ROLIGO DENTAL: Master-CM172041 (Master-CM172041) — 4 locs
  ORPHAN: EDWARD F SPIEGEL DDS (Master-CM062882) | currently: EDWARD F SPIEGEL DDS: Master-CM062882
  ADDRESS: 984 N Broadway, Yonkers 

  ANCHOR: ROLIGO DENTAL: Master-CM172041 (Master-CM172041) — 4 locs
  ORPHAN: THOMAS BAZDEKIS (Master-CM057526) | currently: THOMAS BAZDEKIS: Master-CM057526
  ADDRESS: 984 N Broadway Ste L-03, Yonkers 

  ANCHOR: LAKEVIEW DENTAL: Master-CM1493456 (Master-CM1493456) — 5 locs
  ORPHAN: STRATFORD ORTHODONTICS PC (Master-CM107289) | currently: STRATFORD ORTHODONTICS PC: Master-CM107289
  ADDRESS: 2499 Main St Ste 1, Stratford 

  ANCHOR: LAKEVIEW DENTAL: Master-CM1493456 (Master-CM1493456) — 5 locs
  ORPHAN: STRATFORD ORTHODONTICS (Master-CM047170) | currently: STRATFORD ORTHODONTICS: Master-CM047170
  ADDRESS: 2499 Main St Unit D, Stratford 

  ANCHOR: JON-PAUL VANREGENMRTER: Master-CM208039 (Master-CM208039) — 3 locs
  ORPHAN: DENTAL ASSOCS OF WAKEFIELD (Master-CM224709) | currently: DENTAL ASSOCS OF WAKEFIELD: Master-CM224709
  ADDRESS: 26 S County Commons Way Ste A6, Wakefield 

  ANCHOR: PLUM DENTAL GROUP LLC: Master-CM17673266 (Master-CM17673266) — 11 locs
  ORPHAN: LEE W MCNEISH DMD (Master-CM268401) | currently: LEE W MCNEISH DMD: Master-CM268401
  ADDRESS: 650 Chase Pkwy Ste 1, Waterbury 

  ANCHOR: NORTH AMERICAN DENTAL GROUP: Master-CM074662 (Master-CM074662) — 16 locs
  ORPHAN: GUERRINO DENTISTRY (Master-CM17685416) | currently: GUERRINO DENTISTRY: Master-CM17685416
  ADDRESS: 455 Central Park Ave Ste 2, Scarsdale 

  ANCHOR: NORTH AMERICAN DENTAL GROUP: Master-CM074662 (Master-CM074662) — 16 locs
  ORPHAN: ANN ECKHOFF (Master-CM069903) | currently: ANN ECKHOFF: Master-CM069903
  ADDRESS: 455 Central Park Ave, Scarsdale 

  ANCHOR: NORTH AMERICAN DENTAL GROUP: Master-CM074662 (Master-CM074662) — 16 locs
  ORPHAN: ALBERT TSAI (Master-CM163337) | currently: ALBERT TSAI: Master-CM163337
  ADDRESS: 455 Central Park Ave, Scarsdale 

  ANCHOR: NORTH AMERICAN DENTAL GROUP: Master-CM074662 (Master-CM074662) — 16 locs
  ORPHAN: GENERATION FAMILY DENTAL L (Master-CM944411) | currently: GENERATION FAMILY DENTAL L: Master-CM944411
  ADDRESS: 455 Central Park Ave Ste 3, Scarsdale 

  ANCHOR: NORTH AMERICAN DENTAL GROUP: Master-CM074662 (Master-CM074662) — 16 locs
  ORPHAN: MADELON RUTH MURPHY DMD (Master-CM252714) | currently: MADELON RUTH MURPHY DMD: Master-CM252714
  ADDRESS: 455 Central Park Ave Ste 309, Scarsdale 

  ANCHOR: ALPHA DENTAL: Master-CM168437 (Master-CM168437) — 3 locs
  ORPHAN: ALPHA DENTAL - NO. DARTMOU (Master-CM1788916) | currently: ALPHA DENTAL - NO. DARTMOU: Master-CM1788916
  ADDRESS: 145 Faunce Corner Mall Rd, North Dartmouth 

  ANCHOR: THE HRHCARE HEALTH CENTER AT POUGHKEEPSIE: Master-CM1004874 (Master-CM1004874) — 4 locs
  ORPHAN: JOON S. LEE DDS PC (Master-CM193514) | currently: JOON S. LEE DDS PC: Master-CM193514
  ADDRESS: 503 S Broadway Suite 250, Yonkers 

  ANCHOR: WESTCHESTER PUTNAM ENDODONTIC ASSOCIATES: Master-CM083552 (Master-CM083552) — 3 locs
  ORPHAN: STERN ORTHODONTICS (Master-CM305441) | currently: STERN ORTHODONTICS: Master-CM305441
  ADDRESS: 101 S Bedford Rd Ste 214, Mount Kisco 

  ANCHOR: WESTCHESTER PUTNAM ENDODONTIC ASSOCIATES: Master-CM083552 (Master-CM083552) — 3 locs
  ORPHAN: GREENWICH SMILES (Master-CM178209) | currently: GREENWICH SMILES: Master-CM178209
  ADDRESS: 25 Valley Dr Ste 2a, Greenwich 

  ANCHOR: AFFORDABLE CARE: Master-CM828468 (Master-CM828468) — 6 locs
  ORPHAN: JEFFREY HINDIN (Master-CM047258) | currently: JEFFREY HINDIN: Master-CM047258
  ADDRESS: 2 Executive Blvd Ste 206, Suffern 



================================================================================
SECTION 4: PLUM DENTAL — COMPLETE OFFICE MAPPING
================================================================================
Plum has 44 offices mapped to 16 different Kerr parent groups.
Only 3 Plum parent CMs exist in Kerr: CM94845, CM17673266, CM1302473
  Plum office: Capalbo, Michael Brian
  Kerr account: RON CAPALBO (Master-CM385952) in COUSINS,CONSTANCE DDS: Master-CM052034
  Address: 130 Granite St, Westerly

  Plum office: Capalbo Dental Grp Of Wickford
  Kerr account: COUSINS,CONSTANCE DDS (Master-CM052034) in COUSINS,CONSTANCE DDS: Master-CM052034
  Address: 29 Updike Ave, North Kingstown

  Plum office: Capitol Hill Dental
  Kerr account: HENRY LEVIN DMD (Master-CM051593) in HENRY LEVIN DMD: Master-CM051593
  Address: 276 Smith St, Providence

  Plum office: Hanzel, Melvin
  Kerr account: ASCHAFFENBURG & ENGLISH (Master-CM061279) in ASCHAFFENBURG & ENGLISH: Master-CM061279
  Address: 222 Jefferson Blvd Ste 100, Warwick

  Plum office: Childrens Dentistry Of RI LLC
  Kerr account: RON CAPALBO (Master-CM385952) in COUSINS,CONSTANCE DDS: Master-CM052034
  Address: 130 Granite St Ste C, Westerly

  Plum office: Warwick   Dr. Ragge
  Kerr account: ASCHAFFENBURG & ENGLISH (Master-CM061279) in ASCHAFFENBURG & ENGLISH: Master-CM061279
  Address: 222 Jefferson Blvd, Warwick

  Plum office: Ocean State Ortho   Westerly
  Kerr account: RON CAPALBO (Master-CM385952) in COUSINS,CONSTANCE DDS: Master-CM052034
  Address: 130 Granite St, Westerly

  Plum office: Family Dentist Inc
  Kerr account: FAMILY DENTIST INC (Master-CM1777243) in FAMILY DENTIST INC: Master-CM1777243
  Address: 480 Broadway, Pawtucket

  Plum office: Cranston Dental Assoc LLC
  Kerr account: LORI G POLACEK MD (Master-CM606766) in LORI G POLACEK MD: Master-CM606766
  Address: 2000 Chapel View Blvd Ste 370, Cranston

  Plum office: Cranston Dental Assoc LLC
  Kerr account: STEVEN A FAZZINI DMD (Master-CM207391) in STEVEN A FAZZINI DMD: Master-CM207391
  Address: 2000 Chapel View Blvd Ste 370, Cranston

  Plum office: Capalbo, Michael
  Kerr account: STEPHEN T SKOLY (Master-CM313121) in STEPHEN T SKOLY: Master-CM313121
  Address: 30 Chapel View Blvd Ste 200, Cranston

  Plum office: Capalbo, Michael
  Kerr account: DR. WILLIAM LORD DELGIZZO, DMD (Master-CM168023) in DR. WILLIAM LORD DELGIZZO, DMD: Master-CM168023
  Address: 30 Chapel View Blvd Ste 200, Cranston

  Plum office: Marcus Capalbo
  Kerr account: DR ELLIOT H KIMMEL & ASSOCIATES PC (Master-CM230703) in DR ELLIOT H KIMMEL & ASSOCIATES PC: Master-CM230703
  Address: 27 Broad St, New London

  Plum office: Rocky Hill Dental Group PLLC
  Kerr account: ROCKY HILL DENTAL GROUP PLLC (Master-CM1237563) in ROCKY HILL DENTAL GROUP PLLC: Master-CM1237563
  Address: 412 Cromwell Ave, Rocky Hill

  Plum office: Mansfield Family Dental PLLC
  Kerr account: DR DONALD GRIPPO (Master-CM258714) in SPECIALTY 1 PARTNERS: Master-CM1836151
  Address: 10 Higgins Hwy Ste 1, Mansfield Center

  Plum office: West Side Dental PLLC
  Kerr account: LEE W MCNEISH DMD (Master-CM268401) in LEE W MCNEISH DMD: Master-CM268401
  Address: 650 Chase Pkwy Ste 3, Waterbury

  Plum office: Cheshire Family Dental, PLLC
  Kerr account: MOON SOO LEE DDS (Master-CM171763) in DENTAL ASSOCIATES OF CONNECTICUT
  Address: 1090 Meriden Waterbury Tpke, Cheshire

  Plum office: Cheshire Family Dental, PLLC
  Kerr account: MARC CRAIG DMD (Master-CM9817324) in MARC CRAIG DMD: Master-CM9817324
  Address: 1090 Meriden Waterbury Tpke, Cheshire

  Plum office: Cheshire Family Dental, PLLC
  Kerr account: R & A ASSOCIATES OF CHESHIRE LLC (Master-CM888988) in R & A ASSOCIATES OF CHESHIRE LLC: Master-CM888988
  Address: 1090 Meriden Waterbury Tpke, Cheshire



================================================================================
SECTION 5: GROUP_ACCOUNT.CSV TRUTH FILE RESULTS
================================================================================
74 groups, 258 children — 100% authoritative
57 groups match preloaded data perfectly
17 groups have discrepancies (preloaded has MORE children than truth file)
Pattern: Kerr lumps acquired practices under DSO parent CMs even when they kept original names
These extras are CORRECT — they are real DSO acquisitions


================================================================================
SECTION 6: GOLD/SILVER ACCELERATE FINDINGS
================================================================================
14 groups, 69 children
Advanced Dental Brands: 27 locations in Gold/Silver, only 6 in preloaded (24 missing = MA territory)
Smile Source: 17 locations in Gold/Silver, 9 in preloaded (8 missing)
Beacon Oral Specialists: 3 locations, entirely missing from preloaded
Many Gold/Silver accounts are outside current preloaded territory (MA-heavy)


================================================================================
SECTION 7: EMAIL DOMAIN MATCHES
================================================================================
358 accounts have emails (out of ~5,000+)
18 domains with 2+ accounts, but most are generic (gmail, aol, yahoo)
4 org-specific domains with cross-parent matches:
  @allaboutkidsteeth.com — 2 accounts, confirms Abra Dental link
  @scarsdaleoralsurgery.com — 2 accounts, links Breiman + Langsam
  @ct.gov — 3 accounts (government, not an org merge)
  @nyu.edu — 3 accounts (alumni, not an org merge)


================================================================================
SECTION 8: OVERLAY STATUS
================================================================================
Current overlay: CLEAN (commit a87cc7dbe3)
Only 1 custom group: Edge Dental Management (Master-CM047997, 8 children)
26 auto-created groups were REMOVED (they were causing corruption)
CRITICAL: save-overlay must be changed to atomic patch operations to prevent stale data stomping fixes


================================================================================
SECTION 9: RECOMMENDATIONS
================================================================================

IMMEDIATE (before Q1 closes):
1. Fix overlay save system — atomic patches, not full-file overwrites
2. Kill localStorage overlay cache — always load fresh from API
3. Add address display to account cards
4. Add group affiliation badge to account cards

SHORT TERM:
5. Wire buildOrgClusters into CSV upload flow (Tier 1/2 auto-merge, Tier 3 suggestions)
6. Build "Group Truth Import" — upload truth files (like Group_Account.csv) that override Kerr's parent assignments
7. Surface anchor-orphan discoveries as merge suggestions in the UI
8. Add "related accounts at this address" view
9. Store zero-dollar prospect locations in overlay for group completeness

MEDIUM TERM:
10. Guest CSV viewer for showing other reps their data
11. Multi-rep support (separate overlays per rep)
12. Scoring improvements for Today tab
13. Better account workspace (notes, activity, contacts)
